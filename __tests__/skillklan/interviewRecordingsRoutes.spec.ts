// @vitest-environment node
// Requirement — the owner, 2026-10-16: recordings are for everyone signed in
// to SkillKlan Job except the excluded ("as always" — an excluded student's
// session ends within 5 minutes, so no session → nothing here). Listening
// loads the file from Google Drive through this server: seeking works (206
// with Content-Range), "download" saves it, only library files are served,
// and Google's failures do not leak to the browser.
import { NextRequest } from "next/server";

const ctx = vi.hoisted(() => ({
  session: { value: { user: { id: "u1" } } as null | { user: { id: string } } },
  configured: { value: true },
  list: vi.fn(),
  find: vi.fn(),
  bytes: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("@/skillklan/interviewRecordings", () => ({
  isRecordingsConfigured: () => ctx.configured.value,
  listRecordings: ctx.list,
  findRecording: ctx.find,
  fetchRecordingBytes: ctx.bytes,
}));

import { GET as listGET } from "@/app/api/skillklan/interview-recordings/route";
import { GET as streamGET } from "@/app/api/skillklan/interview-recordings/[id]/route";

const RECORDING = {
  id: "fileQaTech001",
  kind: "qaTech",
  mimeType: "audio/mpeg",
  title: "24.09.2026 - Mobile+API - Іван Петренко - Monobank",
  date: "2026-09-24",
  specializations: ["Mobile", "API"],
  person: "Іван Петренко",
  company: "Monobank",
};

const stream = (path: string, headers: Record<string, string> = {}) =>
  streamGET(new NextRequest(`https://jobs.example.invalid${path}`, { headers }), {
    params: Promise.resolve({ id: decodeURIComponent(path.split("/").pop()!.split("?")[0]) }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  ctx.session.value = { user: { id: "u1" } };
  ctx.configured.value = true;
  ctx.list.mockResolvedValue([RECORDING]);
  ctx.find.mockResolvedValue(RECORDING);
  ctx.bytes.mockResolvedValue(
    new Response("abc", { status: 206, headers: { "content-range": "bytes 0-2/2000", "content-length": "3", "content-type": "application/octet-stream" } }),
  );
});

describe("the list", () => {
  it("signed in → the library", async () => {
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recordings: [RECORDING] });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("no session (signed out, or excluded and the session ended) → 401, Drive not asked", async () => {
    ctx.session.value = null;
    expect((await listGET()).status).toBe(401);
    expect(ctx.list).not.toHaveBeenCalled();
  });

  it("not connected → 404", async () => {
    ctx.configured.value = false;
    expect((await listGET()).status).toBe(404);
    expect(ctx.list).not.toHaveBeenCalled();
  });

  it("Google failed → 502 without Google's words", async () => {
    ctx.list.mockRejectedValue(new Error("google token: 401 invalid_grant secret-ish detail"));
    const res = await listGET();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/google|invalid_grant|secret/i);
  });
});

describe("one recording", () => {
  it("passes the browser's Range on and answers 206 with Content-Range — the player can seek", async () => {
    const res = await stream("/api/skillklan/interview-recordings/fileQaTech001", { range: "bytes=0-2" });
    expect(ctx.bytes).toHaveBeenCalledWith("fileQaTech001", "bytes=0-2", expect.anything());
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-2/2000");
    expect(res.headers.get("content-length")).toBe("3");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    // The type is the recording's, not whatever Drive said.
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.text()).toBe("abc");
  });

  it("?download=1 → saved as a file named after the recording", async () => {
    const res = await stream("/api/skillklan/interview-recordings/fileQaTech001?download=1");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent(`${RECORDING.title}.mp3`)}`,
    );
  });

  it("no session → 401, nothing looked up or fetched", async () => {
    ctx.session.value = null;
    expect((await stream("/api/skillklan/interview-recordings/fileQaTech001")).status).toBe(401);
    expect(ctx.find).not.toHaveBeenCalled();
    expect(ctx.bytes).not.toHaveBeenCalled();
  });

  it("a file outside the library → 404, Drive not asked for bytes", async () => {
    ctx.find.mockResolvedValue(null);
    expect((await stream("/api/skillklan/interview-recordings/someoneElsesFile")).status).toBe(404);
    expect(ctx.bytes).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])("Drive answers %s → 502, no body of Google's", async (status) => {
    ctx.bytes.mockResolvedValue(new Response("Google error page", { status }));
    const res = await stream("/api/skillklan/interview-recordings/fileQaTech001");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("Google error page");
  });
});
