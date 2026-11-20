// @vitest-environment node
// Requirement — the owner, 2026-11-20 (D104): transcribe through ElevenLabs
// (Scribe). The request follows ElevenLabs' docs (POST /v1/speech-to-text,
// read 2026-11-20): `xi-api-key` header, multipart/form-data with `model_id`
// (scribe_v3 — the most accurate one for recorded audio), `diarize` (who
// speaks, D106), `file`. What comes back that we can't use, or a refusal, is
// a failure in our words; out of credits (402, or 401 "quota_exceeded") is told
// apart from a wrong key, because the first pauses the queue until it is topped
// up (D104). The key never shows in an error.
// The body is checked with the platform's own multipart parser (Request.formData),
// not with ours.
import { createHash } from "crypto";
import {
  ELEVENLABS_STT_URL,
  TranscribeError,
  elevenLabsKey,
  transcribe,
} from "@/skillklan/transcripts/elevenLabs";

const KEY = "sk_test_0123456789abcdef0123456789abcdef";
const AUDIO = new Uint8Array(Array.from({ length: 200_000 }, (_, i) => (i * 7) % 256));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function audioStream(): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= AUDIO.length) return controller.close();
      controller.enqueue(AUDIO.subarray(offset, offset + 65_536));
      offset += 65_536;
    },
  });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const OK = {
  language_code: "ukr",
  language_probability: 0.97,
  text: "Добрий день",
  audio_duration_secs: 1.2,
  words: [
    { text: "Добрий", type: "word", start: 0, end: 0.4, speaker_id: "speaker_0", logprob: -0.1 },
    { text: " ", type: "spacing", start: 0.4, end: 0.5, speaker_id: "speaker_0", logprob: 0 },
    { text: "день", type: "word", start: 0.5, end: 0.9, speaker_id: "speaker_0", logprob: -0.1 },
  ],
};

describe("the request", () => {
  it("POST to the speech-to-text endpoint with the key in xi-api-key and the whole file, byte for byte", async () => {
    let seen: { url: string; key: string | null; form: FormData } | null = null;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const req = new Request(url as string, init);
      seen = { url: req.url, key: req.headers.get("xi-api-key"), form: await req.formData() };
      return json(200, OK);
    });

    const result = await transcribe({ key: KEY, audio: audioStream(), mimeType: "audio/mp4", fetchImpl: fetchImpl as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
    expect(seen!.url).toBe(ELEVENLABS_STT_URL);
    expect(seen!.url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(seen!.key).toBe(KEY);
    expect(seen!.form.get("model_id")).toBe("scribe_v3");
    expect(seen!.form.get("diarize")).toBe("true");
    const file = seen!.form.get("file") as File;
    expect(file.type).toBe("audio/mp4");
    expect(sha(new Uint8Array(await file.arrayBuffer()))).toBe(sha(AUDIO));

    expect(result).toEqual({ languageCode: "ukr", durationSecs: 1.2, words: OK.words });
  });

  it("a mime type that does not look like one is not passed on", async () => {
    let type = "";
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      type = ((await new Request(url as string, init).formData()).get("file") as File).type;
      return json(200, OK);
    };
    await transcribe({ key: KEY, audio: audioStream(), mimeType: 'audio/mp4"\r\nX-Evil: 1', fetchImpl: fetchImpl as typeof fetch });
    expect(type).toBe("application/octet-stream");
  });
});

describe("refusals, in our words", () => {
  const cases: [string, () => Response | Promise<Response>, string][] = [
    ["402 — out of credits", () => json(402, { detail: { status: "insufficient_credits" } }), "credits"],
    ["401 quota_exceeded — out of credits too", () => json(401, { detail: { status: "quota_exceeded", message: "…" } }), "credits"],
    ["401 otherwise — the key", () => json(401, { detail: { status: "invalid_api_key" } }), "auth"],
    ["429 — too many requests now", () => json(429, { detail: {} }), "busy"],
    ["422 — the file", () => json(422, { detail: [] }), "rejected"],
    ["500 — the provider", () => new Response("oops", { status: 500 }), "provider"],
    ["200 without words — not something we can use", () => json(200, { text: "…" }), "provider"],
    ["200 with a malformed word", () => json(200, { words: [{ text: 1 }] }), "provider"],
  ];

  it.each(cases)("%s", async (_name, response, code) => {
    const fetchImpl = async () => response();
    const error = await transcribe({ key: KEY, audio: audioStream(), mimeType: "audio/mpeg", fetchImpl: fetchImpl as typeof fetch }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TranscribeError);
    expect((error as TranscribeError).code).toBe(code);
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it("no answer at all (network) — the provider", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await transcribe({ key: KEY, audio: audioStream(), mimeType: "audio/mpeg", fetchImpl }).catch((e: unknown) => e);
    expect((error as TranscribeError).code).toBe("provider");
  });
});

describe("the key", () => {
  it("from ELEVENLABS_API_KEY, trimmed; missing or blank — no key", () => {
    expect(elevenLabsKey({ ELEVENLABS_API_KEY: `  ${KEY}\n` } as unknown as NodeJS.ProcessEnv)).toBe(KEY);
    expect(elevenLabsKey({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(elevenLabsKey({ ELEVENLABS_API_KEY: "   " } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
