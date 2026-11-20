import "server-only";
import prisma from "@/lib/db";
import { readFeatureFlags } from "@/skillklan/featureFlags";
import { fetchRecordingBytes, findRecording } from "@/skillklan/interviewRecordings";
import { TRANSCRIBE_MODEL, elevenLabsKey, transcribe } from "./elevenLabs";
import { createTranscriptQueue, type TranscriptQueue } from "./queue";

// The one queue of this server — on globalThis, so every route bundle and the
// startup hook (instrumentation.ts) share it: one worker, one pause.
declare const globalThis: { skillklanTranscripts?: TranscriptQueue } & typeof global;

export function transcriptQueue(): TranscriptQueue {
  return (globalThis.skillklanTranscripts ??= createTranscriptQueue({
    db: prisma,
    isOn: async () => (await readFeatureFlags()).transcripts,
    key: () => elevenLabsKey(),
    inLibrary: findRecording,
    openAudio: async (id) => {
      const res = await fetchRecordingBytes(id, null);
      if (res.status !== 200 || !res.body) {
        await res.body?.cancel().catch(() => {});
        return null;
      }
      return res.body;
    },
    transcribe: (args) => transcribe(args),
    model: TRANSCRIBE_MODEL,
    log: (message) => console.error(`[transcripts] ${message}`),
  }));
}
