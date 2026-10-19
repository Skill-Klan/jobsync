// @vitest-environment node
// Requirement — the backend contract (documentation/05-api/JOBSYNC_LOGIN_API.md
// in the backend repo) and SkillKlan rules §2.3: every call to the backend is
// fail-closed. Missing configuration, a timeout, a non-200 answer, a network
// error or an answer of the wrong shape all mean "no session" / "no access";
// the exchange is never retried (the code burns on first use); the code is
// never written to a log.
import {
  CABINET_API_TIMEOUT_MS,
  checkCabinetAccess,
  exchangeLoginCode,
  getCabinetAccess,
  managesSkillklanJob,
} from "@/skillklan/cabinetApi";

const BASE = "https://api.example.invalid";
const SECRET = "test-secret-not-real";
const CODE = "A".repeat(43);

function answer(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SKILLKLAN_API_URL = `${BASE}/`;
  process.env.JOBSYNC_API_SECRET = SECRET;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.SKILLKLAN_API_URL;
  delete process.env.JOBSYNC_API_SECRET;
});

describe("exchangeLoginCode", () => {
  it("posts the code to the backend with the secret and returns the person", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { userId: 42, role: "student", name: "Марія" }, error: null }));

    await expect(exchangeLoginCode(CODE)).resolves.toEqual({ userId: 42, role: "student", name: "Марія" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/jobsync/login-code/exchange`);
    expect(init.method).toBe("POST");
    expect(init.headers["x-jobsync-secret"]).toBe(SECRET);
    expect(JSON.parse(init.body)).toEqual({ code: CODE });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // Owner 2026-10-19 (D81): the QA moderator comes in too.
  it("the QA moderator → let in with that role", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { userId: 7, role: "qa_moderator", name: "Модератор" }, error: null }));
    await expect(exchangeLoginCode(CODE)).resolves.toEqual({ userId: 7, role: "qa_moderator", name: "Модератор" });
  });

  it.each([
    ["401 (used, expired or unknown code)", 401, { error: "Unauthorized", code: "JOBSYNC_CODE_INVALID" }],
    ["403 (no access any more)", 403, { error: "Forbidden", code: "JOBSYNC_ACCESS_DENIED" }],
    ["503 (secret not set on the backend)", 503, { error: "service_unavailable" }],
    ["200 without the envelope", 200, { userId: 42, role: "student" }],
    ["200 with a role outside student/admin/qa_moderator (a mentor)", 200, { success: true, data: { userId: 42, role: "mentor", name: "x" } }],
    ["200 with a non-integer id", 200, { success: true, data: { userId: "42", role: "student", name: "x" } }],
    // A proxy or error page that happens to carry a valid-looking envelope.
    ["500 with a valid-looking body", 500, { success: true, data: { userId: 42, role: "student", name: "x" }, error: null }],
  ])("%s → no session, no retry", async (_label, status, body) => {
    fetchMock.mockReturnValue(answer(status, body));
    await expect(exchangeLoginCode(CODE)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("network error → no session, no retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(exchangeLoginCode(CODE)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a backend that never answers is cut off at the timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
      }),
    );
    const pending = exchangeLoginCode(CODE);
    await vi.advanceTimersByTimeAsync(CABINET_API_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBeNull();
    expect(CABINET_API_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it.each([
    ["backend address", "SKILLKLAN_API_URL"],
    ["secret", "JOBSYNC_API_SECRET"],
  ])("without the %s it does not even call", async (_label, name) => {
    delete process.env[name];
    await expect(exchangeLoginCode(CODE)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an empty code is not sent", async () => {
    await expect(exchangeLoginCode("")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never writes the code to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    fetchMock.mockReturnValue(answer(401, { error: "Unauthorized" }));
    await exchangeLoginCode(CODE);
    fetchMock.mockRejectedValue(new Error(`boom ${CODE}`));
    await exchangeLoginCode(CODE);
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(CODE);
    }
    spies.forEach((s) => s.mockRestore());
  });
});

describe("checkCabinetAccess", () => {
  it("asks the backend about this person with the secret", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { allowed: true, role: "student" }, error: null }));
    await expect(checkCabinetAccess(42)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/jobsync/users/42/access`);
    expect(init.headers["x-jobsync-secret"]).toBe(SECRET);
  });

  it("allowed:false → no", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { allowed: false, role: null }, error: null }));
    await expect(checkCabinetAccess(42)).resolves.toBe(false);
  });

  it.each([
    ["503", () => answer(503, { error: "service_unavailable" })],
    ["401", () => answer(401, { error: "unauthorized" })],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["allowed as a string", () => answer(200, { success: true, data: { allowed: "true" } })],
    ["502 with a valid-looking body", () => answer(502, { success: true, data: { allowed: true, role: "student" } })],
  ])("%s → no (fail closed)", async (_label, reply) => {
    fetchMock.mockImplementation(reply);
    await expect(checkCabinetAccess(42)).resolves.toBe(false);
  });

  it("no configuration → no, without a call", async () => {
    delete process.env.JOBSYNC_API_SECRET;
    await expect(checkCabinetAccess(42)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN])("id %s → no, without a call", async (id) => {
    await expect(checkCabinetAccess(id)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// The role rides along (feature switches, owner 2026-10-16: admins only;
// 2026-10-19, D81: and the QA moderator). It is the backend's word; anything
// but a known role is no role — never one that manages.
describe("getCabinetAccess — the role", () => {
  it.each([
    ["admin", { allowed: true, role: "admin" }],
    ["student", { allowed: true, role: "student" }],
    ["qa_moderator", { allowed: true, role: "qa_moderator" }],
    ["mentor", { allowed: true, role: null }],
    ["superadmin", { allowed: true, role: null }],
    [undefined, { allowed: true, role: null }],
  ])("allowed, role %s → %o", async (role, expected) => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { allowed: true, role }, error: null }));
    await expect(getCabinetAccess(42)).resolves.toEqual(expected);
  });

  it.each([
    ["admin", true],
    ["qa_moderator", true],
    ["student", false],
    [null, false],
    [undefined, false],
  ] as const)("managesSkillklanJob(%s) → %s (D81: the QA moderator as the admin)", (role, manages) => {
    expect(managesSkillklanJob(role)).toBe(manages);
  });

  it("not allowed → no role, even if one is sent", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, data: { allowed: false, role: "admin" }, error: null }));
    await expect(getCabinetAccess(42)).resolves.toEqual({ allowed: false, role: null });
  });

  it("a failed call → not allowed, no role", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
    await expect(getCabinetAccess(42)).resolves.toEqual({ allowed: false, role: null });
  });
});
