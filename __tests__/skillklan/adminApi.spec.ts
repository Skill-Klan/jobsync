// @vitest-environment node
// Requirement — the machine API the SkillKlan backend calls for the admin
// pages (contract: backend documentation/05-api/JOBSYNC_ADMIN_API.md):
//   · the only way in is the backend's secret in X-Jobsync-Admin-Secret —
//     not a session: the routes sit outside the session middleware;
//   · fail closed: no secret configured, or one shorter than 32 characters,
//     is 503; a missing or wrong secret is 401 — and in both cases no data is
//     read at all;
//   · its own secret, not JOBSYNC_API_SECRET (the one SkillKlan Job sends the
//     backend): that one does not open this door;
//   · answers are { success: true, data, error: null }, never cached;
//   · a person who never came in is `user: null`, not 404; a malformed id is
//     400 before any read;
//   · a failure inside is 500 with no detail.
vi.mock("@/skillklan/adminStats", () => ({
  collectUserStats: vi.fn(),
  countUnlinkedAccounts: vi.fn(),
}));
vi.mock("@/lib/telemetry", () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { collectUserStats, countUnlinkedAccounts } from "@/skillklan/adminStats";
import { GET as allStats } from "@/app/skillklan/admin/stats/route";
import { GET as personStats } from "@/app/skillklan/admin/stats/[cabinetUserId]/route";
import { config as middlewareConfig } from "@/middleware";

const collect = collectUserStats as unknown as ReturnType<typeof vi.fn>;
const unlinked = countUnlinkedAccounts as unknown as ReturnType<typeof vi.fn>;

const SECRET = "s".repeat(40);
const ROW = { cabinetUserId: 7, jobs: { total: 3 } };

function req(path: string, secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers["x-jobsync-admin-secret"] = secret;
  return new Request(`https://jobs.example.invalid${path}`, { headers });
}
const person = (id: string, secret?: string) =>
  personStats(req(`/skillklan/admin/stats/${id}`, secret), { params: Promise.resolve({ cabinetUserId: id }) });
const all = (secret?: string) => allStats(req("/skillklan/admin/stats", secret));

beforeEach(() => {
  collect.mockReset();
  unlinked.mockReset();
  process.env.JOBSYNC_ADMIN_API_SECRET = SECRET;
  process.env.JOBSYNC_API_SECRET = "j".repeat(40);
});

afterAll(() => {
  delete process.env.JOBSYNC_ADMIN_API_SECRET;
  delete process.env.JOBSYNC_API_SECRET;
});

describe("the door", () => {
  it("is not behind the session middleware — a server calls it, not a person", () => {
    const covers = (p: string) => middlewareConfig.matcher.some((m) => new RegExp(`^${m}$`).test(p));
    // Anchor: the same check does see the session-guarded paths.
    expect(covers("/api/jobs/export")).toBe(true);
    expect(covers("/skillklan/admin/stats")).toBe(false);
    expect(covers("/skillklan/admin/stats/7")).toBe(false);
  });

  it.each([
    ["not configured", undefined],
    ["shorter than 32 characters", "x".repeat(31)],
  ])("secret %s — 503 on both routes, nothing read", async (_label, configured) => {
    if (configured === undefined) delete process.env.JOBSYNC_ADMIN_API_SECRET;
    else process.env.JOBSYNC_ADMIN_API_SECRET = configured;

    const a = await all(configured ?? SECRET);
    const p = await person("7", configured ?? SECRET);
    expect(a.status).toBe(503);
    expect(p.status).toBe(503);
    expect(await a.json()).toEqual({ success: false, data: null, error: "service_unavailable" });
    expect(collect).not.toHaveBeenCalled();
    expect(unlinked).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["wrong", "w".repeat(40)],
    ["the other direction's secret (JOBSYNC_API_SECRET)", "j".repeat(40)],
    // (Not "with a trailing space": Fetch trims header values before we see them.)
    ["the right one minus its last character", SECRET.slice(0, -1)],
    ["the right one plus a character", `${SECRET}s`],
  ])("secret %s — 401 on both routes, nothing read", async (_label, sent) => {
    const a = await all(sent);
    const p = await person("7", sent);
    expect(a.status).toBe(401);
    expect(p.status).toBe(401);
    expect(await p.json()).toEqual({ success: false, data: null, error: "unauthorized" });
    expect(collect).not.toHaveBeenCalled();
    expect(unlinked).not.toHaveBeenCalled();
  });
});

describe("GET /skillklan/admin/stats", () => {
  it("everyone's numbers and the unlinked count in the envelope; not cached", async () => {
    collect.mockResolvedValue([ROW]);
    unlinked.mockResolvedValue(0);

    const res = await all(SECRET);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      error: null,
      data: { users: [ROW], unlinkedAccounts: 0, generatedAt: expect.any(String) },
    });
    expect(collect).toHaveBeenCalledWith();
  });

  it("a failure inside — 500 with no detail", async () => {
    collect.mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));
    unlinked.mockResolvedValue(0);
    const res = await all(SECRET);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/SQLITE|locked/);
  });
});

describe("GET /skillklan/admin/stats/:cabinetUserId", () => {
  it("one person's numbers, asked for by that id only", async () => {
    collect.mockResolvedValue([ROW]);
    const res = await person("7", SECRET);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).data.user).toEqual(ROW);
    expect(collect).toHaveBeenCalledWith([7]);
  });

  it("someone who never came in — user: null, not 404", async () => {
    collect.mockResolvedValue([]);
    const res = await person("8", SECRET);
    expect(res.status).toBe(200);
    expect((await res.json()).data.user).toBeNull();
  });

  it.each(["0", "-1", "abc", "1.5", "2147483648", "07"])("malformed id %s — 400, nothing read", async (id) => {
    const res = await person(id, SECRET);
    expect(res.status).toBe(400);
    expect(collect).not.toHaveBeenCalled();
  });
});
