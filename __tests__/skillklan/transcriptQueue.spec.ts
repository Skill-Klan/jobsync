// @vitest-environment node
// Requirement — the owner, 2026-11-20: anyone presses «Транскрибувати» on a
// recording; the transcript is kept, so pressing it again shows the text at
// once — for everyone (one text per recording). D104: through ElevenLabs, with
// limits: one job per person waiting in the queue; when the credits run out a
// recording is not lost mid-way — it waits, and new ones are refused («тимчасово
// недоступна») until they are topped up. Rules §4.1: it costs money, so it has a
// switch — off, nothing is sent. The provider is called once per recording and
// never twice at the same time; a restart does not lose a job.
// Real migrations on a real SQLite file; the provider, Drive and the switch are
// stand-ins with the real shapes.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { TranscribeError, type ProviderTranscript } from "@/skillklan/transcripts/elevenLabs";
import { PAUSE_MS, createTranscriptQueue, type QueueDeps } from "@/skillklan/transcripts/queue";

const ROOT = path.resolve(__dirname, "../..");
let dir: string;
let db: PrismaClient;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-transcripts-queue-"));
  const url = `file:${path.join(dir, "queue.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  db = new PrismaClient({ datasources: { db: { url } } });
  for (const id of ["ann", "bob"]) await db.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.recordingTranscript.deleteMany();
});

const LIBRARY = new Set(["recAAAAAAAAAA", "recBBBBBBBBBB", "recCCCCCCCCCC"]);

const SPOKEN: ProviderTranscript = {
  languageCode: "ukr",
  durationSecs: 1800,
  words: [
    { text: "Розкажіть", type: "word", start: 0, speaker_id: "speaker_0" },
    { text: " ", type: "spacing", start: null, speaker_id: "speaker_0" },
    { text: "про", type: "word", start: 0.6, speaker_id: "speaker_0" },
    { text: " ", type: "spacing", start: null, speaker_id: "speaker_0" },
    { text: "себе.", type: "word", start: 0.9, speaker_id: "speaker_0" },
    { text: "Я", type: "word", start: 3, speaker_id: "speaker_1" },
    { text: " ", type: "spacing", start: null, speaker_id: "speaker_1" },
    { text: "тестувальниця.", type: "word", start: 3.2, speaker_id: "speaker_1" },
  ],
};

function setup(overrides: Partial<QueueDeps> & { provider?: (call: number) => Promise<ProviderTranscript> } = {}) {
  const clock = { now: Date.parse("2026-11-20T12:00:00Z") };
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const provider = overrides.provider ?? (async () => SPOKEN);
  const deps: QueueDeps = {
    db,
    isOn: async () => true,
    key: () => "sk_test_key_0123456789",
    inLibrary: async (id) => (LIBRARY.has(id) ? { mimeType: "audio/mp4" } : null),
    openAudio: async () => new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array([1, 2, 3])), c.close()) }),
    transcribe: async ({ audio }) => {
      calls.push("call");
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await audio.cancel();
        return await provider(calls.length);
      } finally {
        inFlight -= 1;
      }
    },
    model: "scribe_v3",
    now: () => clock.now,
    ...overrides,
  };
  const queue = createTranscriptQueue(deps);
  return { queue, clock, calls, maxInFlight: () => maxInFlight };
}

describe("one transcript per recording, made once, for everyone", () => {
  it("the first press queues it; when done the text is kept with who speaks and when", async () => {
    const { queue, calls } = setup();
    expect(await queue.read("recAAAAAAAAAA")).toEqual({ status: "none" });

    expect(await queue.request("recAAAAAAAAAA", "ann")).toEqual({ ok: true, status: expect.stringMatching(/queued|running|done/) });
    await queue.kick();

    expect(await queue.read("recAAAAAAAAAA")).toEqual({
      status: "done",
      languageCode: "ukr",
      segments: [
        { speaker: 1, start: 0, text: "Розкажіть про себе." },
        { speaker: 2, start: 3, text: "Я тестувальниця." },
      ],
    });
    expect(calls).toHaveLength(1);
    const row = await db.recordingTranscript.findUniqueOrThrow({ where: { recordingId: "recAAAAAAAAAA" } });
    expect(row).toMatchObject({ model: "scribe_v3", durationSecs: 1800, failure: null });
  });

  it("someone else pressing it after — the text at once, the provider is not called again", async () => {
    const { queue, calls } = setup();
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.kick();
    expect(await queue.request("recAAAAAAAAAA", "bob")).toEqual({ ok: true, status: "done" });
    await queue.kick();
    expect(calls).toHaveLength(1);
  });

  it("a person whose own recording still waits gets a finished text at once — not «wait for your previous one»", async () => {
    await db.recordingTranscript.create({ data: { recordingId: "recAAAAAAAAAA", status: "done", segments: "[]" } });
    await db.recordingTranscript.create({ data: { recordingId: "recBBBBBBBBBB", status: "queued", requestedById: "bob" } });
    const { queue } = setup({ isOn: async () => false });
    expect(await queue.request("recAAAAAAAAAA", "bob")).toEqual({ ok: true, status: "done" });
  });

  it("pressed by two while it waits — one job, one call", async () => {
    const { queue, calls } = setup();
    await Promise.all([queue.request("recAAAAAAAAAA", "ann"), queue.request("recAAAAAAAAAA", "bob")]);
    await queue.kick();
    expect(await db.recordingTranscript.count()).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("silence — done with no text; pressing again does not pay for it again", async () => {
    const { queue, calls } = setup({ provider: async () => ({ languageCode: null, durationSecs: 600, words: [] }) });
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toEqual({ status: "done", segments: [], languageCode: null });
    await queue.request("recAAAAAAAAAA", "bob");
    await queue.kick();
    expect(calls).toHaveLength(1);
  });
});

describe("limits (D104)", () => {
  it("one job per person waiting: a second recording of the same person is refused, another person's is not", async () => {
    // The provider holds ann's first recording until released — it is still waiting.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const { queue } = setup({ provider: async () => (await held, SPOKEN) });
    expect(await queue.request("recAAAAAAAAAA", "ann")).toMatchObject({ ok: true });
    expect(await queue.request("recBBBBBBBBBB", "ann")).toEqual({ ok: false, reason: "busy" });
    expect(await queue.request("recBBBBBBBBBB", "bob")).toMatchObject({ ok: true });
    release();
    await queue.kick();
    // Once ann's first is done, her next one is welcome.
    expect(await queue.request("recCCCCCCCCCC", "ann")).toMatchObject({ ok: true });
    await queue.kick();
    expect(Object.values(await queue.states()).sort()).toEqual(["done", "done", "done"]);
  });

  it("the provider is never called for two recordings at the same time", async () => {
    const { queue, maxInFlight, calls } = setup({ provider: async () => (await new Promise((r) => setTimeout(r, 20)), SPOKEN) });
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.request("recBBBBBBBBBB", "bob");
    await queue.kick();
    expect(calls).toHaveLength(2);
    expect(maxInFlight()).toBe(1);
  });

  it("out of credits: the recording waits (not failed), new ones are refused, and it is made once the pause is over", async () => {
    const { queue, clock, calls } = setup({
      provider: async (call) => {
        if (call === 1) throw new TranscribeError("credits");
        return SPOKEN;
      },
    });
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toEqual({ status: "queued" });
    expect(await queue.availability()).toBe("unavailable");
    expect(await queue.request("recBBBBBBBBBB", "bob")).toEqual({ ok: false, reason: "unavailable" });

    // Still paused a minute before the end: nothing is sent.
    clock.now += PAUSE_MS.credits - 60_000;
    await queue.kick();
    expect(calls).toHaveLength(1);

    clock.now += 60_000;
    expect(await queue.availability()).toBe("on");
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toMatchObject({ status: "done" });
    expect(calls).toHaveLength(2);
  });

  it("a wrong key pauses the same way — the job waits for the fix", async () => {
    const { queue } = setup({ provider: async () => Promise.reject(new TranscribeError("auth")) });
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toEqual({ status: "queued" });
    expect(await queue.availability()).toBe("unavailable");
  });
});

describe("the switch and the key (rules §4.1)", () => {
  it("off: nothing is sent; on: the same job is made", async () => {
    let on = false;
    const { queue, calls } = setup({ isOn: async () => on });
    // Queued while it was on, waiting when the admin switched it off.
    await db.recordingTranscript.create({ data: { recordingId: "recAAAAAAAAAA", status: "queued", requestedById: "ann" } });
    await queue.kick();
    expect(calls).toHaveLength(0);
    expect(await queue.availability()).toBe("off");

    on = true;
    await queue.kick();
    expect(calls).toHaveLength(1);
  });

  it("no key: nothing can be asked for, and the page is told it is unavailable", async () => {
    const { queue, calls } = setup({ key: () => null });
    expect(await queue.request("recAAAAAAAAAA", "ann")).toEqual({ ok: false, reason: "unavailable" });
    expect(await queue.availability()).toBe("unavailable");
    await queue.kick();
    expect(calls).toHaveLength(0);
    expect(await db.recordingTranscript.count()).toBe(0);
  });
});

describe("failures", () => {
  it("the provider rejects the file: failed — and asking again queues it anew", async () => {
    const { queue, calls } = setup({
      provider: async (call) => {
        if (call === 1) throw new TranscribeError("rejected");
        return SPOKEN;
      },
    });
    await queue.request("recAAAAAAAAAA", "ann");
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toEqual({ status: "failed" });
    expect((await db.recordingTranscript.findUniqueOrThrow({ where: { recordingId: "recAAAAAAAAAA" } })).failure).toBe("rejected");
    // A failed job does not count as ann's waiting one.
    expect(await queue.request("recAAAAAAAAAA", "bob")).toMatchObject({ ok: true });
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toMatchObject({ status: "done" });
    expect(calls).toHaveLength(2);
  });

  it("a recording that left the library is not sent anywhere", async () => {
    const { queue, calls } = setup();
    await queue.request("recGONEGONEGO", "ann");
    await queue.kick();
    expect(calls).toHaveLength(0);
    expect(await queue.read("recGONEGONEGO")).toEqual({ status: "failed" });
  });

  it("a restart in the middle: the job left «running» goes back to the queue and is made", async () => {
    await db.recordingTranscript.create({
      data: { recordingId: "recAAAAAAAAAA", status: "running", requestedById: "ann", startedAt: new Date() },
    });
    const { queue, calls } = setup();
    await queue.resume();
    await queue.kick();
    expect(await queue.read("recAAAAAAAAAA")).toMatchObject({ status: "done" });
    expect(calls).toHaveLength(1);
  });
});
