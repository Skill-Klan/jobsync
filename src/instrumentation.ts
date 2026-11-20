export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncSchedulerState } = await import("@/lib/scheduler");
    await syncSchedulerState();
    // Transcripts left «running» by a restart go back to the queue (D104).
    const { transcriptQueue } = await import("@/skillklan/transcripts/service");
    await transcriptQueue()
      .resume()
      .catch((error) => console.error("[transcripts] resume failed", error instanceof Error ? error.name : "unknown"));
  }
}
