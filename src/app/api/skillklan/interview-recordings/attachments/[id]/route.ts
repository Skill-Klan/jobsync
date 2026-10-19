import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { AttachmentTooLargeError, findAttachment } from "@/skillklan/interviewRecordings";
import { AttachmentUnviewableError, attachmentContent } from "@/skillklan/attachmentContent";
import { VIEWER_HEADER } from "@/skillklan/recordingAttachments";

// One attachment, in the form the library page shows (owner 2026-10-19: view,
// no download — D80). Only files placed in the library are served
// (findAttachment), and only to the page itself: it asks with
// VIEWER_HEADER, which a link opened in a tab or a "save link as" does not
// send — so the address of an attachment opens nothing on its own.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  if (req.headers.get(VIEWER_HEADER) !== "1") {
    return NextResponse.json({ error: "Open it in the library" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const attachment = await findAttachment(id);
    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const content = await attachmentContent(attachment, req.signal);
    const headers = new Headers({
      "content-type": content.contentType,
      "cache-control": "private, no-store",
      // Shown, not saved; and never run as a page of this site.
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
    });
    if (content.truncated) headers.set("x-skillklan-truncated", "1");
    return new Response(new Uint8Array(content.body), { status: 200, headers });
  } catch (error) {
    if (error instanceof AttachmentUnviewableError) {
      return NextResponse.json({ error: "Cannot be shown" }, { status: 415 });
    }
    if (error instanceof AttachmentTooLargeError) {
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("[interview-recordings] attachment failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
