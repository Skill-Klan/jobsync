import "server-only";
import type { PrismaClient } from "@prisma/client";
import { parseSegments, segmentsFromWords, type TranscriptSegment } from "./segments";
import { TranscribeError, type ProviderTranscript, type TranscribeFailure } from "./elevenLabs";
import type { CreditWatch } from "./creditWatch";

// The transcription queue (owner 2026-11-20): anyone presses «Транскрибувати»
// on a recording; the transcript is made once and kept — pressing again opens
// the text at once, for everyone (one row per recording, RecordingTranscript).
//
// A background job, not one request: Cloudflare in front of jobs. cuts a
// response that waits longer than ~100 s, and an hour of audio takes minutes.
// The button queues the recording, the page asks for its state every few
// seconds, and the work goes on if the page is closed.
//
// · One at a time: one provider request in flight for the whole app.
// · One job per person waiting: a second recording of the same person is
//   refused until the first is done (owner D104 «наші ліміти»).
// · The provider can't take work (no credits, a wrong key, too many requests):
//   the job stays queued and the queue pauses; new jobs are refused meanwhile
//   — «Транскрибація тимчасово недоступна» instead of a failure mid-way.
// · Anything else fails the job; asking again queues it anew.
// · A restart finds jobs left «running» and queues them again (resume).
// · The account's credits (D104, D109): nearly out or overage billing on — no
//   new job is queued or started (creditWatch.ts); before and after each job
//   the balance is read, and the credits it took go to the log (the price of an
//   hour is not known yet — D104).

export type TranscriptStatus = "queued" | "running" | "done" | "failed";
const WAITING: TranscriptStatus[] = ["queued", "running"];

// How long the queue waits after the provider said it can't take work.
export const PAUSE_MS = {
  credits: 60 * 60 * 1000,
  auth: 60 * 60 * 1000,
  busy: 60 * 1000,
} as const satisfies Partial<Record<TranscribeFailure, number>>;

export type QueueDeps = {
  db: PrismaClient;
  // The «Транскрибація» switch, read fresh: the queue runs outside a request.
  isOn: () => Promise<boolean>;
  key: () => string | null;
  // The recording if it is still in the library (only those are transcribed).
  inLibrary: (id: string) => Promise<{ mimeType: string } | null>;
  // The recording's bytes from Drive; null — Drive did not give them.
  openAudio: (id: string) => Promise<ReadableStream<Uint8Array> | null>;
  transcribe: (args: { key: string; audio: ReadableStream<Uint8Array>; mimeType: string }) => Promise<ProviderTranscript>;
  model: string;
  // The credits watch (D104, D108–D112); absent — no credit checks.
  credits?: Pick<CreditWatch, "check" | "blocked">;
  now?: () => number;
  log?: (message: string) => void;
};

export type TranscriptView =
  | { status: "none" | "queued" | "running" | "failed" }
  | { status: "done"; segments: TranscriptSegment[]; languageCode: string | null };

export type RequestResult =
  | { ok: true; status: TranscriptStatus }
  | { ok: false; reason: "busy" | "unavailable" };

export type Availability = "off" | "unavailable" | "on";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export function createTranscriptQueue(deps: QueueDeps) {
  const { db } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  let pausedUntil = 0;
  let draining: Promise<void> | null = null;
  let again = false;

  const paused = () => now() < pausedUntil;

  async function availability(): Promise<Availability> {
    if (!(await deps.isOn())) return "off";
    return deps.key() && !paused() && !deps.credits?.blocked() ? "on" : "unavailable";
  }

  // recordingId → status, for the library page (one read, no per-row calls).
  async function states(): Promise<Record<string, TranscriptStatus>> {
    const rows = await db.recordingTranscript.findMany({ select: { recordingId: true, status: true } });
    return Object.fromEntries(rows.map((r) => [r.recordingId, r.status as TranscriptStatus]));
  }

  async function read(recordingId: string): Promise<TranscriptView> {
    const row = await db.recordingTranscript.findUnique({ where: { recordingId } });
    if (!row) return { status: "none" };
    if (row.status === "done") {
      return { status: "done", segments: parseSegments(row.segments), languageCode: row.languageCode };
    }
    return { status: row.status as "queued" | "running" | "failed" };
  }

  async function request(recordingId: string, userId: string): Promise<RequestResult> {
    const existing = await db.recordingTranscript.findUnique({ where: { recordingId } });
    // Made or being made — nobody pays twice, whoever asks.
    if (existing && existing.status !== "failed") {
      void kick();
      return { ok: true, status: existing.status as TranscriptStatus };
    }
    if (!deps.key() || paused() || deps.credits?.blocked()) return { ok: false, reason: "unavailable" };
    const mine = await db.recordingTranscript.count({ where: { requestedById: userId, status: { in: WAITING } } });
    if (mine > 0) return { ok: false, reason: "busy" };

    const queued = { status: "queued", failure: null, requestedById: userId, createdAt: new Date(now()), startedAt: null, finishedAt: null };
    try {
      if (existing) {
        await db.recordingTranscript.updateMany({ where: { recordingId, status: "failed" }, data: queued });
      } else {
        await db.recordingTranscript.create({ data: { recordingId, ...queued } });
      }
    } catch (error) {
      // Two people at the same moment: the other one's job is the job.
      if (!isUniqueViolation(error)) throw error;
    }
    void kick();
    const row = await db.recordingTranscript.findUnique({ where: { recordingId }, select: { status: true } });
    return { ok: true, status: (row?.status ?? "queued") as TranscriptStatus };
  }

  // Returns the seconds of audio transcribed, when it was.
  async function run(recordingId: string, key: string): Promise<number | null> {
    const finish = (data: Record<string, unknown>) =>
      db.recordingTranscript.updateMany({ where: { recordingId, status: "running" }, data: { ...data, finishedAt: new Date(now()) } });
    const fail = (failure: string) => finish({ status: "failed", failure });

    const recording = await deps.inLibrary(recordingId).catch(() => null);
    if (!recording) {
      await fail("source");
      return null;
    }
    const audio = await deps.openAudio(recordingId).catch(() => null);
    if (!audio) {
      await fail("source");
      return null;
    }

    let result: ProviderTranscript;
    try {
      result = await deps.transcribe({ key, audio, mimeType: recording.mimeType });
    } catch (error) {
      await audio.cancel().catch(() => {});
      const code: TranscribeFailure = error instanceof TranscribeError ? error.code : "provider";
      if (code === "credits" || code === "auth" || code === "busy") {
        pausedUntil = now() + PAUSE_MS[code];
        log(`provider can't take work (${code}), the queue pauses`);
        await db.recordingTranscript.updateMany({ where: { recordingId, status: "running" }, data: { status: "queued", startedAt: null } });
        return null;
      }
      log(`a job failed (${code})`);
      await fail(code);
      return null;
    }
    // Silence or music only: done, with no text — asking again would pay for the same.
    await finish({
      status: "done",
      segments: JSON.stringify(segmentsFromWords(result.words)),
      languageCode: result.languageCode,
      durationSecs: result.durationSecs,
      model: deps.model,
      failure: null,
    });
    return result.durationSecs;
  }

  async function drain(): Promise<void> {
    for (;;) {
      if (paused() || !(await deps.isOn())) return;
      const key = deps.key();
      if (!key) return;
      const job = await db.recordingTranscript.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
      if (!job) return;
      const before = deps.credits ? await deps.credits.check() : null;
      if (deps.credits?.blocked()) return;
      const claimed = await db.recordingTranscript.updateMany({
        where: { recordingId: job.recordingId, status: "queued" },
        data: { status: "running", startedAt: new Date(now()) },
      });
      if (claimed.count !== 1) continue;
      const seconds = await run(job.recordingId, key);
      const after = deps.credits ? await deps.credits.check() : null;
      if (seconds !== null && before?.known && after?.known) {
        log(`a job took ${before.remaining - after.remaining} credits for ${Math.round(seconds)} s of audio`);
      }
    }
  }

  // Starts the worker if it is not running; a kick while it runs makes it look
  // for work once more before it stops. Resolves when it stops.
  function kick(): Promise<void> {
    if (draining) {
      again = true;
      return draining;
    }
    draining = (async () => {
      do {
        again = false;
        await drain();
      } while (again && !paused());
    })()
      .catch((error) => log(`the queue stopped: ${error instanceof Error ? error.name : "unknown"}`))
      .finally(() => {
        draining = null;
      });
    return draining;
  }

  // On start: a job left «running» by a restart is queued again.
  async function resume(): Promise<void> {
    await db.recordingTranscript.updateMany({ where: { status: "running" }, data: { status: "queued", startedAt: null } });
    void kick();
  }

  return { availability, states, read, request, kick, resume };
}

export type TranscriptQueue = ReturnType<typeof createTranscriptQueue>;
