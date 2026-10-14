// @vitest-environment node
// Requirement — SkillKlan rules §3.4 and §4.2: an excluded student loses
// access within 5 minutes, and the session itself is short. The session asks
// the backend at least every 5 minutes; "no", an error and a timeout all end
// it (fail closed — checkCabinetAccess already maps errors to false). A
// session with no cabinet person behind it exists only with the dev flag.
//
// One page load calls auth() many times (middleware, layout, page, server
// components), and each reads the same stale cookie. Those calls must share
// one backend answer — measured on the dev server before the fix: 12 calls
// for one page — and the 5-minute bound counts from that real answer.
vi.mock("@/skillklan/cabinetApi", () => ({ checkCabinetAccess: vi.fn() }));

import { authConfig, ACCESS_RECHECK_MS } from "@/auth.config";
import { checkCabinetAccess } from "@/skillklan/cabinetApi";

const jwt = authConfig.callbacks.jwt as (args: any) => Promise<any>;
const check = checkCabinetAccess as unknown as ReturnType<typeof vi.fn>;
const T0 = new Date("2030-01-01T10:00:00Z").getTime();
const MINUTE = 60 * 1000;
// A fresh cabinet person per test: shared answers live for the process.
let personId = 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  check.mockReset();
  personId += 1;
  delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sign-in", () => {
  it("records the cabinet person and the time of the check", async () => {
    const token = await jwt({ token: {}, user: { id: "u-1", cabinetUserId: 42 } });
    expect(token).toMatchObject({ id: "u-1", cabinetUserId: 42, accessCheckedAt: T0 });
    expect(check).not.toHaveBeenCalled();
  });
});

describe("re-check", () => {
  const signedIn = () => ({ id: "u-1", cabinetUserId: personId, accessCheckedAt: T0 });

  it("within 5 minutes — no call to the backend", async () => {
    vi.setSystemTime(T0 + 4 * MINUTE + 59 * 1000);
    await expect(jwt({ token: signedIn() })).resolves.toMatchObject({ cabinetUserId: personId });
    expect(check).not.toHaveBeenCalled();
  });

  it("after 5 minutes and still allowed — the session goes on, the clock restarts", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(true);
    const token = await jwt({ token: signedIn() });
    expect(check).toHaveBeenCalledWith(personId);
    expect(token).toMatchObject({ cabinetUserId: personId, accessCheckedAt: T0 + 5 * MINUTE });
  });

  it("after 5 minutes and no longer allowed (or the backend failed) — the session ends", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(false);
    await expect(jwt({ token: signedIn() })).resolves.toBeNull();
  });

  it("a token without a check time is checked at once", async () => {
    check.mockResolvedValue(false);
    await expect(jwt({ token: { id: "u-1", cabinetUserId: personId } })).resolves.toBeNull();
    expect(check).toHaveBeenCalledWith(personId);
  });

  it("the window is at most 5 minutes", () => {
    expect(ACCESS_RECHECK_MS).toBeLessThanOrEqual(5 * MINUTE);
  });
});

describe("one page load, many auth() calls", () => {
  const stale = (id = personId) => ({ id: "u-1", cabinetUserId: id, accessCheckedAt: T0 });
  const deferred = () => {
    let resolve!: (v: boolean) => void;
    const promise = new Promise<boolean>((r) => (resolve = r));
    return { promise, resolve };
  };

  it("at the same moment — one backend call, the same answer for every caller", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    const answer = deferred();
    check.mockReturnValue(answer.promise);
    const calls = Array.from({ length: 12 }, () => jwt({ token: stale() }));
    answer.resolve(true);
    const tokens = await Promise.all(calls);
    expect(check).toHaveBeenCalledTimes(1);
    for (const t of tokens) expect(t).toMatchObject({ cabinetUserId: personId, accessCheckedAt: T0 + 5 * MINUTE });
  });

  it("one after another a moment later (middleware, then the render) — still one call", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(true);
    await jwt({ token: stale() });
    vi.setSystemTime(T0 + 5 * MINUTE + 2 * 1000);
    await jwt({ token: stale() });
    vi.setSystemTime(T0 + 5 * MINUTE + 4 * 1000);
    await jwt({ token: stale() });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("the shared answer keeps the time of the real check, so the 5 minutes count from it", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(true);
    await jwt({ token: stale() });
    vi.setSystemTime(T0 + 5 * MINUTE + 3 * 1000);
    await expect(jwt({ token: stale() })).resolves.toMatchObject({ accessCheckedAt: T0 + 5 * MINUTE });
  });

  it("a 'no' is shared too — every caller ends the session", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(false);
    const tokens = await Promise.all(Array.from({ length: 5 }, () => jwt({ token: stale() })));
    expect(check).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual([null, null, null, null, null]);
  });

  it("different people are not mixed up — each gets their own answer", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    const other = personId + 500;
    check.mockImplementation(async (id: number) => id === other);
    const [mine, theirs] = await Promise.all([jwt({ token: stale() }), jwt({ token: stale(other) })]);
    expect(check).toHaveBeenCalledTimes(2);
    expect(mine).toBeNull();
    expect(theirs).toMatchObject({ cabinetUserId: other });
  });

  it("a revocation is seen at most 5 minutes after the last real answer", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(true);
    const refreshed = await jwt({ token: stale() });
    check.mockResolvedValue(false);
    vi.setSystemTime(T0 + 10 * MINUTE);
    await expect(jwt({ token: refreshed })).resolves.toBeNull();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("a failing backend call is a 'no', not a crash", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockRejectedValue(new Error("boom"));
    await expect(jwt({ token: stale() })).resolves.toBeNull();
  });
});

describe("a session with no cabinet person", () => {
  it("ends, unless the dev-only password login is on", async () => {
    await expect(jwt({ token: { id: "u-dev" } })).resolves.toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it("lives on with the dev flag (local development, Playwright)", async () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    await expect(jwt({ token: { id: "u-dev" } })).resolves.toMatchObject({ id: "u-dev" });
  });
});

describe("session length", () => {
  it("is short — a working day, not the 30-day default", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.session?.maxAge).toBeLessThanOrEqual(12 * 60 * 60);
  });
});
