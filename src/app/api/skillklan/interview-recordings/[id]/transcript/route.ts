import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isFeatureOff } from "@/skillklan/featureFlags";
import { findRecording } from "@/skillklan/interviewRecordings";
import { transcriptQueue } from "@/skillklan/transcripts/service";

// The transcript of one recording (owner 2026-11-20, D104–D106) — for everyone
// signed in, like the recordings themselves (D57, D60):
//   GET  — its state, and the text once it is done;
//   POST — «Транскрибувати»: queue it (or just tell the state if it is queued,
//          being made or made — nobody pays twice).
// Only recordings of the library; behind the «Транскрибація» switch (it costs
// money, rules §4.1) — switched off, the route answers as if it did not exist.
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

type Found = { error: NextResponse } | { id: string; userId: string };

async function recordingOf(params: Promise<{ id: string }>): Promise<Found> {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Not Authenticated" }, { status: 401 }) };
  if (await isFeatureOff("transcripts")) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const { id } = await params;
  const recording = await findRecording(id).catch(() => undefined);
  if (recording === undefined) return { error: NextResponse.json({ error: "Unavailable" }, { status: 502 }) };
  if (!recording) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { id, userId: session.user.id };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await recordingOf(params);
  if ("error" in found) return found.error;
  const queue = transcriptQueue();
  const view = await queue.read(found.id);
  // A page waiting for a transcript also keeps the worker going after a pause.
  if (view.status === "queued") void queue.kick();
  return NextResponse.json(view, { headers: NO_STORE });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await recordingOf(params);
  if ("error" in found) return found.error;
  const result = await transcriptQueue().request(found.id, found.userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "busy" ? 409 : 503, headers: NO_STORE },
    );
  }
  return NextResponse.json({ status: result.status }, { headers: NO_STORE });
}
