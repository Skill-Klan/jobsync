// Requirement — SkillKlan rules §5.1: no own sign-up and no passwords.
//   · the dev flag turns password sign-in on only outside a production build;
//   · /signin without the flag sends people to the cabinet and, after a failed
//     cabinet sign-in, says so — no password field anywhere;
//   · /signup without the flag is a 404.
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/auth/AuthCard", () => ({
  default: ({ mode }: { mode: string }) => <div data-testid="password-auth-card">{mode}</div>,
}));

import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";
import Signin from "@/app/(auth)/signin/page";
import Signup from "@/app/(auth)/signup/page";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isDevPasswordLoginEnabled", () => {
  it.each([
    ["no flag", undefined, "test", false],
    ["flag in development", "1", "development", true],
    ["flag in test", "1", "test", true],
    ["flag in a production build", "1", "production", false],
    ["a stray flag value", "true", "development", false],
  ])("%s → %s", (_label, flag, nodeEnv, expected) => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: nodeEnv as "development" | "production" | "test" };
    if (flag === undefined) delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
    else process.env.JOBSYNC_DEV_PASSWORD_LOGIN = flag;
    expect(isDevPasswordLoginEnabled()).toBe(expected);
  });
});

describe("/signin", () => {
  it("without the flag — sign in from the cabinet, a link to it, no password", async () => {
    delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
    process.env.CABINET_URL = "https://app.example.invalid";
    const { container } = render(await Signin({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: /sign in from your cabinet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the cabinet/i })).toHaveAttribute("href", "https://app.example.invalid/");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByTestId("password-auth-card")).toBeNull();
  });

  // Code review 2026-10-18: one reader of CABINET_URL for every link to the cabinet (cabinetLink) —
  // not an http(s) address is no link here either, the same as in the menu.
  it.each([["javascript:alert(1)"], ["app.example.invalid"]])("CABINET_URL %j → no link to it, the rest is there", async (raw) => {
    delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
    process.env.CABINET_URL = raw;
    render(await Signin({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: /sign in from your cabinet/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open the cabinet/i })).toBeNull();
    delete process.env.CABINET_URL;
  });

  it("after a failed cabinet sign-in — says so plainly", async () => {
    delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
    render(await Signin({ searchParams: Promise.resolve({ error: "cabinet" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/did not go through/i);
  });

  it("with the dev flag — the upstream password form", async () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    render(await Signin({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("password-auth-card")).toHaveTextContent("signin");
  });
});

describe("/signup", () => {
  it("without the flag — 404", () => {
    delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
    expect(() => Signup()).toThrow("NEXT_NOT_FOUND");
  });

  it("with the dev flag — the upstream sign-up form", () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    render(Signup());
    expect(screen.getByTestId("password-auth-card")).toHaveTextContent("signup");
  });
});
