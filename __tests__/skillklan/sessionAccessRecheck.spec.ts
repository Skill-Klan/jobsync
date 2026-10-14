// @vitest-environment node
// Requirement — SkillKlan rules §3.4 and §4.2: an excluded student loses
// access within 5 minutes, and the session itself is short. The session asks
// the backend at least every 5 minutes; "no", an error and a timeout all end
// it (fail closed — checkCabinetAccess already maps errors to false). A
// session with no cabinet person behind it exists only with the dev flag.
vi.mock("@/skillklan/cabinetApi", () => ({ checkCabinetAccess: vi.fn() }));

import { authConfig, ACCESS_RECHECK_MS } from "@/auth.config";
import { checkCabinetAccess } from "@/skillklan/cabinetApi";

const jwt = authConfig.callbacks.jwt as (args: any) => Promise<any>;
const check = checkCabinetAccess as unknown as ReturnType<typeof vi.fn>;
const T0 = new Date("2030-01-01T10:00:00Z").getTime();
const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  check.mockReset();
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
  const signedIn = () => ({ id: "u-1", cabinetUserId: 42, accessCheckedAt: T0 });

  it("within 5 minutes — no call to the backend", async () => {
    vi.setSystemTime(T0 + 4 * MINUTE + 59 * 1000);
    await expect(jwt({ token: signedIn() })).resolves.toMatchObject({ cabinetUserId: 42 });
    expect(check).not.toHaveBeenCalled();
  });

  it("after 5 minutes and still allowed — the session goes on, the clock restarts", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(true);
    const token = await jwt({ token: signedIn() });
    expect(check).toHaveBeenCalledWith(42);
    expect(token).toMatchObject({ cabinetUserId: 42, accessCheckedAt: T0 + 5 * MINUTE });
  });

  it("after 5 minutes and no longer allowed (or the backend failed) — the session ends", async () => {
    vi.setSystemTime(T0 + 5 * MINUTE);
    check.mockResolvedValue(false);
    await expect(jwt({ token: signedIn() })).resolves.toBeNull();
  });

  it("a token without a check time is checked at once", async () => {
    check.mockResolvedValue(false);
    await expect(jwt({ token: { id: "u-1", cabinetUserId: 42 } })).resolves.toBeNull();
    expect(check).toHaveBeenCalledWith(42);
  });

  it("the window is at most 5 minutes", () => {
    expect(ACCESS_RECHECK_MS).toBeLessThanOrEqual(5 * MINUTE);
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
