import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchRecordingBytes, findRecording } from "@/skillklan/interviewRecordings";

// One recording, streamed from Google Drive — with the browser's Range, so the
// player seeks without downloading the whole file. `?download=1` saves it.
// Only files from the library are served (findRecording).
export const dynamic = "force-dynamic";

const PASS_HEADERS = ["content-length", "content-range", "accept-ranges"];

function attachmentName(title: string, mimeType: string): string {
  const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "audio";
  return encodeURIComponent(`${title}.${ext === "mpeg" ? "mp3" : ext}`);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  const { id } = await params;
  try {
    const recording = await findRecording(id);
    if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const upstream = await fetchRecordingBytes(id, req.headers.get("range"), req.signal);
    if (upstream.status !== 200 && upstream.status !== 206) {
      console.error("[interview-recordings] drive answered", upstream.status);
      return NextResponse.json({ error: "Unavailable" }, { status: 502 });
    }
    const headers = new Headers({
      "content-type": recording.mimeType,
      "cache-control": "private, no-store",
    });
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    if (req.nextUrl.searchParams.get("download") === "1") {
      headers.set(
        "content-disposition",
        `attachment; filename*=UTF-8''${attachmentName(recording.title, recording.mimeType)}`,
      );
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("[interview-recordings] stream failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
