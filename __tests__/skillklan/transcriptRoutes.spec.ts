// @vitest-environment node
// Requirement — the owner, 2026-11-20 (D104–D106): «Транскрибувати» for anyone
// signed in, like the recordings (D57, D60 — no session, nothing); only
// recordings of the library; it costs money, so it is behind its switch
// (rules §4.1, «Транскрибація»): off — no button (the list says nothing about
// transcripts) and the server refuses as if it did not exist. Pressing on a
// recording that is made or being made just tells its state; a second
// recording of the same person while the first waits — refused (409); the
// provider can't take work — «тимчасово недоступна» (503).
import { NextRequest } from "next/server";

const ctx = vi.hoisted(() => ({
  session: { value: { user: { id: "u1" } } as null | { user: { id: string } } },
  flags: { transcripts: true },
  find: vi.fn(),
  list: vi.fn(),
  queue: {
    read: vi.fn(),
    request: vi.fn(),
    kick: vi.fn(async () => {}),
    states: vi.fn(),
    availability: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("@/skillklan/featureFlags", () => ({
  getFeatureFlags: async () => ctx.flags,
  isFeatureOff: async (key: "transcripts") => !ctx.flags[key],
}));
vi.mock("@/skillklan/interviewRecordings", () => ({
  isRecordingsConfigured: () => true,
  listLibrary: ctx.list,
  findRecording: ctx.find,
}));
vi.mock("@/skillklan/transcripts/service", () => ({ transcriptQueue: () => ctx.queue }));

import { GET as listGET } from "@/app/api/skillklan/interview-recordings/route";
import { GET, POST } from "@/app/api/skillklan/interview-recordings/[id]/transcript/route";

const RECORDING = { id: "fileQaTech001", kind: "qaTech", mimeType: "audio/mpeg", title: "x", date: null, specializations: [], person: null, company: "Monobank" };
const OTHER = { ...RECORDING, id: "fileQaTech002" };
type Handler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
const call = (handler: Handler, id: string) =>
  handler(new NextRequest(`https://jobs.example.invalid/api/skillklan/interview-recordings/${id}/transcript`, { method: handler === GET ? "GET" : "POST" }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  ctx.session.value = { user: { id: "u1" } };
  ctx.flags.transcripts = true;
  ctx.find.mockReset().mockImplementation(async (id: string) => ([RECORDING, OTHER].find((r) => r.id === id) ?? null));
  ctx.list.mockReset().mockResolvedValue({ recordings: [RECORDING, OTHER], attachments: [] });
  for (const fn of Object.values(ctx.queue)) fn.mockClear();
  ctx.queue.read.mockReset().mockResolvedValue({ status: "none" });
  ctx.queue.request.mockReset().mockResolvedValue({ ok: true, status: "queued" });
  ctx.queue.states.mockReset().mockResolvedValue({});
  ctx.queue.availability.mockReset().mockResolvedValue("on");
});

describe("who and when", () => {
  it.each([["GET", GET], ["POST", POST]] as const)("%s without a session → 401, the queue untouched", async (_m, handler) => {
    ctx.session.value = null;
    expect((await call(handler, RECORDING.id)).status).toBe(401);
    expect(ctx.queue.read).not.toHaveBeenCalled();
    expect(ctx.queue.request).not.toHaveBeenCalled();
  });

  it.each([["GET", GET], ["POST", POST]] as const)("%s with the switch off → 404, nothing queued; on → it works", async (_m, handler) => {
    ctx.flags.transcripts = false;
    expect((await call(handler, RECORDING.id)).status).toBe(404);
    expect(ctx.queue.request).not.toHaveBeenCalled();
    expect(ctx.queue.read).not.toHaveBeenCalled();

    ctx.flags.transcripts = true;
    expect((await call(handler, RECORDING.id)).status).toBe(200);
  });

  it("a recording outside the library → 404, never queued", async () => {
    expect((await call(POST, "fileNotInLib01")).status).toBe(404);
    expect(ctx.queue.request).not.toHaveBeenCalled();
  });

  it("Drive failing while the recording is looked up → 502, never queued", async () => {
    ctx.find.mockRejectedValue(new Error("drive folder: 500"));
    const res = await call(POST, RECORDING.id);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/drive/i);
    expect(ctx.queue.request).not.toHaveBeenCalled();
  });
});

describe("«Транскрибувати» (POST)", () => {
  it("queues it for the person signed in and tells the state", async () => {
    const res = await call(POST, RECORDING.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "queued" });
    expect(ctx.queue.request).toHaveBeenCalledWith(RECORDING.id, "u1");
  });

  it("the same person's other recording still waits → 409 busy", async () => {
    ctx.queue.request.mockResolvedValue({ ok: false, reason: "busy" });
    const res = await call(POST, RECORDING.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "busy" });
  });

  it("the provider can't take work → 503 unavailable", async () => {
    ctx.queue.request.mockResolvedValue({ ok: false, reason: "unavailable" });
    const res = await call(POST, RECORDING.id);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});

describe("the text (GET)", () => {
  it("done → the segments, not cached by the browser", async () => {
    const view = { status: "done", languageCode: "ukr", segments: [{ speaker: 1, start: 0, text: "Добрий день" }] };
    ctx.queue.read.mockResolvedValue(view);
    const res = await call(GET, RECORDING.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(view);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("the library list", () => {
  it("switch off → no word about transcripts (no button), the queue not touched", async () => {
    ctx.flags.transcripts = false;
    const body = await (await listGET()).json();
    expect(body).toEqual({ recordings: [RECORDING, OTHER], attachments: [] });
    expect(ctx.queue.states).not.toHaveBeenCalled();
  });

  it("switch on → the state of each recording that has one (only those in the library) and whether one can be asked for", async () => {
    ctx.queue.states.mockResolvedValue({ [RECORDING.id]: "done", fileGoneAway01: "done", [OTHER.id]: "queued" });
    const body = await (await listGET()).json();
    expect(body.transcription).toEqual({ available: true, states: { [RECORDING.id]: "done", [OTHER.id]: "queued" } });
    expect(body.recordings).toEqual([RECORDING, OTHER]);

    ctx.queue.availability.mockResolvedValue("unavailable");
    expect((await (await listGET()).json()).transcription.available).toBe(false);
  });
});
