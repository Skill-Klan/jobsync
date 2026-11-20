import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isRecordingsConfigured, listLibrary } from "@/skillklan/interviewRecordings";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { transcriptQueue } from "@/skillklan/transcripts/service";

// The interview recordings library for everyone signed in to SkillKlan Job
// (owner 2026-10-16: "for everyone except the excluded, as always" — the
// session itself ends for an excluded student within 5 minutes). With the
// files lying next to the recordings (2026-10-19, D79: everyone, like the
// recordings).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  if (!isRecordingsConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 404 });
  try {
    const { recordings, attachments } = await listLibrary();
    // Transcripts (D104–D106), only with their switch on: which recordings have
    // one or are being made, and whether a new one can be asked for now. One
    // read for the whole page — no call per row.
    let transcription: { available: boolean; states: Record<string, string> } | undefined;
    if ((await getFeatureFlags()).transcripts) {
      const queue = transcriptQueue();
      const all = await queue.states();
      const states = Object.fromEntries(recordings.filter((r) => all[r.id]).map((r) => [r.id, all[r.id]]));
      transcription = { available: (await queue.availability()) === "on", states };
      if (Object.values(states).includes("queued")) void queue.kick();
    }
    return NextResponse.json(
      { recordings, attachments, ...(transcription && { transcription }) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[interview-recordings] list failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
