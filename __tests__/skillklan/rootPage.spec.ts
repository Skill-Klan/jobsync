// @vitest-environment node
// Requirement — SkillKlan rules §5.1: no own sign-up. "/" sends a signed-in
// person to the dashboard and everyone else to the sign-in page — also on a
// fresh server with no accounts yet, where upstream sent people to /signup
// (a 404 here: the first visitor of a new deploy would land on "not found";
// caught by the image smoke R1, 2026-10-14). Sign-up stays for local
// development behind the dev flag.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { user: { count: vi.fn() } } }));

import RootPage from "@/app/page";
import { auth } from "@/auth";
import db from "@/lib/db";

const session = auth as unknown as ReturnType<typeof vi.fn>;
const userCount = db.user.count as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  session.mockReset();
  userCount.mockReset();
  delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
});

describe("/", () => {
  it("signed in — the dashboard", async () => {
    session.mockResolvedValue({ user: { id: "u-1" } });
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT /dashboard");
  });

  it("not signed in — the sign-in page", async () => {
    session.mockResolvedValue(null);
    userCount.mockResolvedValue(25);
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT /signin");
  });

  it("a fresh server with no accounts yet — still the sign-in page, never /signup", async () => {
    session.mockResolvedValue(null);
    userCount.mockResolvedValue(0);
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT /signin");
  });

  it("with the dev flag and no accounts — the upstream sign-up (local development)", async () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    session.mockResolvedValue(null);
    userCount.mockResolvedValue(0);
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT /signup");
  });

  it("with the dev flag and accounts already there — the sign-in page", async () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    session.mockResolvedValue(null);
    userCount.mockResolvedValue(3);
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT /signin");
  });
});
