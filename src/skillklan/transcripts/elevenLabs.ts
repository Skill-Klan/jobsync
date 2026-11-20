import "server-only";
import { randomUUID } from "crypto";
import type { ProviderWord } from "./segments";

// Speech-to-text through ElevenLabs Scribe (owner 2026-11-20, D104: «будемо
// робити через 11 Labs»). One synchronous request per recording: the audio is
// streamed from Google Drive straight into the request body — a recording is
// never held whole in memory (the container has 1 GB).
//
// Configuration (app.env on Server2): ELEVENLABS_API_KEY. No key → no
// transcription; the key itself never reaches a log, an error or the browser.

export const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
// The most accurate Scribe for recorded audio (docs, 2026-11-20); $0.20 an hour
// on the API price page — the credit price there is contradictory (D104).
export const TRANSCRIBE_MODEL = "scribe_v3";
// One request transcribes the whole recording: minutes for an hour of audio.
// Past this, the job fails and can be asked for again.
export const TRANSCRIBE_TIMEOUT_MS = 30 * 60 * 1000;

const KEY = /^[\x21-\x7e]{16,256}$/;

export function elevenLabsKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.ELEVENLABS_API_KEY?.trim();
  return key && KEY.test(key) ? key : null;
}

// What went wrong, in our words. credits / auth / busy: the provider can't take
// work now — the job waits in the queue; the rest fail the job.
export type TranscribeFailure = "credits" | "auth" | "busy" | "rejected" | "provider" | "timeout";

export class TranscribeError extends Error {
  constructor(readonly code: TranscribeFailure) {
    super(`transcribe: ${code}`);
    this.name = "TranscribeError";
  }
}

export type ProviderTranscript = {
  languageCode: string | null;
  durationSecs: number | null;
  words: ProviderWord[];
};

// A safe Content-Type for the file part: Drive's mime type when it looks like
// one, otherwise "let the provider find out".
function partType(mimeType: string): string {
  return /^[a-z]+\/[\w.+-]+$/i.test(mimeType) ? mimeType : "application/octet-stream";
}

// multipart/form-data with the fields first and the file streamed last.
export function multipartBody(
  boundary: string,
  fields: readonly (readonly [string, string])[],
  file: { name: string; type: string; stream: ReadableStream<Uint8Array> },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const head =
    fields.map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join("") +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${partType(file.type)}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const reader = file.stream.getReader();
  let phase: "head" | "file" | "tail" = "head";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (phase === "head") {
        controller.enqueue(encoder.encode(head));
        phase = "file";
        return;
      }
      if (phase === "file") {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        phase = "tail";
      }
      controller.enqueue(encoder.encode(tail));
      controller.close();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function isWord(value: unknown): value is ProviderWord {
  if (!value || typeof value !== "object") return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.text === "string" &&
    (w.type === undefined || typeof w.type === "string") &&
    (w.start === undefined || w.start === null || typeof w.start === "number") &&
    (w.speaker_id === undefined || w.speaker_id === null || typeof w.speaker_id === "string")
  );
}

async function failureOf(res: Response): Promise<TranscribeFailure> {
  if (res.status === 402) return "credits";
  if (res.status === 401) {
    // Out of credits has come back as 401 "quota_exceeded" too.
    const body = (await res.json().catch(() => null)) as { detail?: { status?: unknown } } | null;
    return body?.detail?.status === "quota_exceeded" ? "credits" : "auth";
  }
  if (res.status === 429) return "busy";
  if (res.status >= 400 && res.status < 500) return "rejected";
  return "provider";
}

export async function transcribe(options: {
  key: string;
  audio: ReadableStream<Uint8Array>;
  mimeType: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ProviderTranscript> {
  const boundary = `skillklan-${randomUUID()}`;
  const body = multipartBody(
    boundary,
    [
      ["model_id", TRANSCRIBE_MODEL],
      ["diarize", "true"],
      ["tag_audio_events", "false"],
      ["timestamps_granularity", "word"],
    ],
    { name: "recording", type: options.mimeType, stream: options.audio },
  );
  const deadline = AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;

  let res: Response;
  try {
    res = await (options.fetchImpl ?? fetch)(ELEVENLABS_STT_URL, {
      method: "POST",
      headers: {
        "xi-api-key": options.key,
        "content-type": `multipart/form-data; boundary=${boundary}`,
        accept: "application/json",
      },
      body,
      // A streamed body (Node's fetch wants it said).
      duplex: "half",
      cache: "no-store",
      signal,
    } as RequestInit & { duplex: "half" });
  } catch {
    throw new TranscribeError(deadline.aborted ? "timeout" : "provider");
  }
  if (!res.ok) throw new TranscribeError(await failureOf(res));

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new TranscribeError(deadline.aborted ? "timeout" : "provider");
  }
  const data = json as { words?: unknown; language_code?: unknown; audio_duration_secs?: unknown };
  if (!data || !Array.isArray(data.words) || !data.words.every(isWord)) throw new TranscribeError("provider");
  return {
    languageCode: typeof data.language_code === "string" ? data.language_code : null,
    durationSecs: typeof data.audio_duration_secs === "number" ? data.audio_duration_secs : null,
    words: data.words,
  };
}
