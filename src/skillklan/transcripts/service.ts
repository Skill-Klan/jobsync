import "server-only";
import prisma from "@/lib/db";
import { readFeatureFlags } from "@/skillklan/featureFlags";
import { fetchRecordingBytes, findRecording } from "@/skillklan/interviewRecordings";
import { TRANSCRIBE_MODEL, elevenLabsKey, transcribe } from "./elevenLabs";
import { createTranscriptQueue, type TranscriptQueue } from "./queue";
import { createCreditWatch, type CreditWatch } from "./creditWatch";
import { readCredits } from "./credits";
import { sendBotAlert } from "./botAlert";

// The one queue and the one credits watch of this server — on globalThis, so
// every route bundle and the startup hook (instrumentation.ts) share them: one
// worker, one pause, one alert state.
declare const globalThis: {
  skillklanTranscripts?: TranscriptQueue;
  skillklanCreditWatch?: { watch: CreditWatch; timer: ReturnType<typeof setInterval> };
} & typeof global;

const log = (message: string) => console.error(`[transcripts] ${message}`);

// Thresholds (owner D104), in app.env so they change without a release:
//   ELEVENLABS_CREDITS_PER_HOUR — credits an hour of recording costs (default:
//     the price page's 330 a minute; measure and set — see creditWatch.ts);
//   TRANSCRIBE_ALERT_HOURS — «закінчуються» below this (default 2, «умовно 2 співбесіди»);
//   TRANSCRIBE_STOP_HOURS — no new transcripts below this (default 1).
function positive(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const CREDIT_CHECK_EVERY_MS = 60 * 60 * 1000;

async function transcriptsOn(): Promise<boolean> {
  return (await readFeatureFlags()).transcripts && elevenLabsKey() !== null;
}

export function creditWatch(): CreditWatch {
  if (!globalThis.skillklanCreditWatch) {
    const watch = createCreditWatch({
      read: () => {
        const key = elevenLabsKey();
        if (!key) return Promise.reject(new Error("no key"));
        return readCredits({ key });
      },
      notify: async (event, minutesLeft) => {
        await sendBotAlert(event, minutesLeft, { log });
      },
      creditsPerHour: positive(process.env.ELEVENLABS_CREDITS_PER_HOUR, 330 * 60),
      lowHours: positive(process.env.TRANSCRIBE_ALERT_HOURS, 2),
      stopHours: positive(process.env.TRANSCRIBE_STOP_HOURS, 1),
      log,
    });
    // Once an hour, while transcripts are on and there is a key; not keeping
    // the process alive on its own.
    const timer = setInterval(() => {
      void transcriptsOn().then((on) => (on ? watch.check() : undefined)).catch(() => {});
    }, CREDIT_CHECK_EVERY_MS);
    timer.unref?.();
    globalThis.skillklanCreditWatch = { watch, timer };
  }
  return globalThis.skillklanCreditWatch.watch;
}

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
    credits: creditWatch(),
    log,
  }));
}

// On start: the first look at the credits, so a lasting problem is told without
// waiting an hour (instrumentation.ts).
export async function checkCreditsOnStart(): Promise<void> {
  if (await transcriptsOn()) await creditWatch().check();
}
