// @vitest-environment node
// Requirement — the owner, 2026-10-16: recordings are for everyone signed in
// to SkillKlan Job except the excluded ("as always" — an excluded student's
// session ends within 5 minutes, so no session → nothing here). Listening
// loads the file from Google Drive through this server: seeking works (206
// with Content-Range), only library files are served, and Google's failures do
// not leak to the browser. Listening only — "there must be no way to
// download" (owner 2026-10-16): always inline, never an attachment.
import { NextRequest } from "next/server";

const ctx = vi.hoisted(() => ({
  session: { value: { user: { id: "u1" } } as null | { user: { id: string } } },
  configured: { value: true },
  list: vi.fn(),
  find: vi.fn(),
  bytes: vi.fn(),
  findAttachment: vi.fn(),
  content: vi.fn(),
  errors: {
    TooLarge: class AttachmentTooLargeError extends Error {},
    Unviewable: class AttachmentUnviewableError extends Error {},
  },
}));

vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("@/skillklan/interviewRecordings", () => ({
  isRecordingsConfigured: () => ctx.configured.value,
  listLibrary: ctx.list,
  findRecording: ctx.find,
  fetchRecordingBytes: ctx.bytes,
  findAttachment: ctx.findAttachment,
  AttachmentTooLargeError: ctx.errors.TooLarge,
}));
vi.mock("@/skillklan/attachmentContent", () => ({
  attachmentContent: ctx.content,
  AttachmentUnviewableError: ctx.errors.Unviewable,
}));

import { GET as listGET } from "@/app/api/skillklan/interview-recordings/route";
import { GET as streamGET } from "@/app/api/skillklan/interview-recordings/[id]/route";
import { GET as attachmentGET } from "@/app/api/skillklan/interview-recordings/attachments/[id]/route";

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

const ATTACHMENT = {
  id: "attQaTech0001",
  name: "task.png",
  mimeType: "image/png",
  size: 10,
  kind: "qaTech",
  company: "Monobank",
  folder: null,
  recordingId: "fileQaTech001",
  view: "image",
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.session.value = { user: { id: "u1" } };
  ctx.configured.value = true;
  ctx.list.mockResolvedValue({ recordings: [RECORDING], attachments: [ATTACHMENT] });
  ctx.findAttachment.mockResolvedValue(ATTACHMENT);
  ctx.content.mockResolvedValue({ body: Buffer.from("webp-bytes"), contentType: "image/webp", truncated: false });
  ctx.find.mockResolvedValue(RECORDING);
  ctx.bytes.mockResolvedValue(
    new Response("abc", { status: 206, headers: { "content-range": "bytes 0-2/2000", "content-length": "3", "content-type": "application/octet-stream" } }),
  );
});

describe("the list", () => {
  it("signed in → the library, its attachments too (2026-10-19, D79: everyone, like the recordings)", async () => {
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recordings: [RECORDING], attachments: [ATTACHMENT] });
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
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(await res.text()).toBe("abc");
  });

  it.each(["?download=1", "?download=true", "?dl=1"])("%s → still inline, never an attachment", async (query) => {
    const res = await stream(`/api/skillklan/interview-recordings/fileQaTech001${query}`);
    expect(res.headers.get("content-disposition")).toBe("inline");
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

// Requirement — the owner, 2026-10-19 (D79, D80): an attachment is viewed on
// the library page by everyone signed in, and never downloaded: the server
// gives it only to the page (which asks with x-skillklan-viewer: 1) — its
// address opened in a tab or saved gets nothing; the answer is shown, not
// saved, and never runs as a page of this site.
describe("one attachment", () => {
  const VIEWER = { "x-skillklan-viewer": "1" };
  const open = (id: string, headers: Record<string, string> = VIEWER) =>
    attachmentGET(new NextRequest(`https://jobs.example.invalid/api/skillklan/interview-recordings/attachments/${id}`, { headers }), {
      params: Promise.resolve({ id }),
    });

  it("asked by the page → the form to show: its type, inline, no-store, nosniff, a sandbox", async () => {
    const res = await open("attQaTech0001");
    expect(res.status).toBe(200);
    expect(ctx.findAttachment).toHaveBeenCalledWith("attQaTech0001");
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
    expect(res.headers.get("x-skillklan-truncated")).toBeNull();
    expect(await res.text()).toBe("webp-bytes");
  });

  it("a long text: the beginning, and the page is told", async () => {
    ctx.content.mockResolvedValue({ body: Buffer.from("text"), contentType: "text/plain; charset=utf-8", truncated: true });
    expect((await open("attQaTech0001")).headers.get("x-skillklan-truncated")).toBe("1");
  });

  it.each([
    ["opened in a tab or saved (no viewer header)", {}],
    ["a viewer header that is not the page's", { "x-skillklan-viewer": "true" }],
  ])("%s → 400, nothing looked up", async (_label, headers) => {
    expect((await open("attQaTech0001", headers)).status).toBe(400);
    expect(ctx.findAttachment).not.toHaveBeenCalled();
    expect(ctx.content).not.toHaveBeenCalled();
  });

  it("no session → 401, nothing looked up", async () => {
    ctx.session.value = null;
    expect((await open("attQaTech0001")).status).toBe(401);
    expect(ctx.findAttachment).not.toHaveBeenCalled();
  });

  it("not in the library → 404, Drive not asked", async () => {
    ctx.findAttachment.mockResolvedValue(null);
    expect((await open("someoneElsesFile")).status).toBe(404);
    expect(ctx.content).not.toHaveBeenCalled();
  });

  it("cannot be shown → 415; too large → 413; Google failed → 502 without Google's words", async () => {
    ctx.content.mockRejectedValueOnce(new ctx.errors.Unviewable("heic"));
    expect((await open("attQaTech0001")).status).toBe(415);
    ctx.content.mockRejectedValueOnce(new ctx.errors.TooLarge("big"));
    expect((await open("attQaTech0001")).status).toBe(413);
    ctx.content.mockRejectedValueOnce(new Error("drive attachment: 403 secret-ish detail"));
    const res = await open("attQaTech0001");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/drive|secret/i);
  });
});
