// @vitest-environment node
// Requirement — the cabinet opens SkillKlan Job with a POST form carrying a
// one-time code (body, never URL). Only the cabinet's origin may post: any
// other origin, or none, is refused without trying the code (login CSRF —
// the cabinet and SkillKlan Job are the same site, SameSite does not help).
// Every failure lands on /signin?error=cabinet; success on /dashboard.
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
// The shared next-auth stub has no AuthError; the route needs the real shape
// of one (as auth.actions.spec does).
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string;
    constructor(type: string) {
      super(type);
      this.type = type;
    }
  }
  return { AuthError };
});

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { POST } from "@/app/auth/cabinet/route";

const CABINET = "https://app.example.invalid";
const CODE = "B".repeat(43);
const signInMock = signIn as unknown as ReturnType<typeof vi.fn>;

class CredentialsSignin extends AuthError {}

function post({ origin, body, url = "https://jobs.example.invalid/auth/cabinet" }: { origin?: string; body?: string; url?: string }) {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (origin !== undefined) headers.origin = origin;
  return POST(new Request(url, { method: "POST", headers, body: body ?? `code=${CODE}` }));
}

beforeEach(() => {
  signInMock.mockReset();
  process.env.CABINET_URL = `${CABINET}/`;
});

afterAll(() => {
  delete process.env.CABINET_URL;
});

describe("POST /auth/cabinet", () => {
  it("from the cabinet with a code — signs in with the cabinet provider and goes to the dashboard", async () => {
    signInMock.mockResolvedValue("/dashboard");
    const res = await post({ origin: CABINET });

    expect(signInMock).toHaveBeenCalledWith("cabinet", { code: CODE, redirect: false });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["another site", "https://evil.example.invalid"],
    ["a look-alike subdomain", "https://app.example.invalid.evil.invalid"],
    ["no Origin at all", undefined],
    ["the literal null origin", "null"],
  ])("from %s — refused without trying the code", async (_label, origin) => {
    const res = await post({ origin });
    expect(signInMock).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/signin?error=cabinet");
  });

  it("refuses everyone when CABINET_URL is not configured (fail closed)", async () => {
    delete process.env.CABINET_URL;
    const res = await post({ origin: CABINET });
    expect(signInMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("/signin?error=cabinet");
  });

  it("reads the code only from the body, never from the URL", async () => {
    const res = await post({ origin: CABINET, body: "", url: `https://jobs.example.invalid/auth/cabinet?code=${CODE}` });
    expect(signInMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("/signin?error=cabinet");
  });

  it("a code the backend rejects — back to sign-in with the generic message", async () => {
    signInMock.mockRejectedValue(new CredentialsSignin("CredentialsSignin"));
    const res = await post({ origin: CABINET });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/signin?error=cabinet");
  });

  it("an unexpected error is not swallowed as a sign-in failure", async () => {
    signInMock.mockRejectedValue(new Error("database is locked"));
    await expect(post({ origin: CABINET })).rejects.toThrow("database is locked");
  });
});
