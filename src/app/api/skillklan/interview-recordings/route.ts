import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isRecordingsConfigured, listRecordings } from "@/skillklan/interviewRecordings";

// The interview recordings library for everyone signed in to SkillKlan Job
// (owner 2026-10-16: "for everyone except the excluded, as always" — the
// session itself ends for an excluded student within 5 minutes).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  if (!isRecordingsConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 404 });
  try {
    const recordings = await listRecordings();
    return NextResponse.json({ recordings }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("[interview-recordings] list failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
