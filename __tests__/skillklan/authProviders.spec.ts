// @vitest-environment node
// Requirement — SkillKlan rules §5.1: sign-in only through the backend. The
// NextAuth instance gets the cabinet provider and nothing else, unless the
// dev-only flag is on (local development, Playwright). The cabinet provider
// opens a session only when the backend accepted the code.
vi.mock("@/skillklan/cabinetApi", () => ({ exchangeLoginCode: vi.fn() }));
vi.mock("@/skillklan/cabinetUser", () => ({ findOrCreateCabinetUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { user: { findUnique: vi.fn() } } }));

import { exchangeLoginCode } from "@/skillklan/cabinetApi";
import { findOrCreateCabinetUser } from "@/skillklan/cabinetUser";

/**
 * Provider configs (as passed to Credentials) of the providers NextAuth got.
 * After resetModules the fresh @/auth gets fresh next-auth stubs — read the
 * calls from those, not from stubs imported before the reset.
 */
async function loadProviders() {
  vi.resetModules();
  const nextAuth = (await import("next-auth")).default as unknown as ReturnType<typeof vi.fn>;
  const credentials = (await import("next-auth/providers/credentials")).default as unknown as ReturnType<typeof vi.fn>;
  nextAuth.mockClear();
  credentials.mockClear();
  await import("@/auth");
  const { providers } = nextAuth.mock.calls[0][0];
  return providers.map((provider: unknown) => {
    const i = credentials.mock.results.findIndex((r) => r.value === provider);
    return credentials.mock.calls[i][0];
  });
}

afterEach(() => {
  delete process.env.JOBSYNC_DEV_PASSWORD_LOGIN;
});

describe("providers", () => {
  it("without the dev flag — only the cabinet provider", async () => {
    const configs = await loadProviders();
    expect(configs.map((c: { id?: string }) => c.id ?? "credentials")).toEqual(["cabinet"]);
  });

  it("with the dev flag — the cabinet provider and the upstream password one", async () => {
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN = "1";
    const configs = await loadProviders();
    expect(configs.map((c: { id?: string }) => c.id ?? "credentials")).toEqual(["cabinet", "credentials"]);
  });
});

describe("cabinet provider", () => {
  async function authorize(credentialsIn: unknown) {
    const [cabinet] = await loadProviders();
    return cabinet.authorize(credentialsIn);
  }

  // The role goes into the session too: only an admin manages the feature
  // switches (owner 2026-10-16), and the role is the backend's.
  it.each(["student", "admin"] as const)("a code the backend accepted — the person's account, with the cabinet id and role (%s)", async (role) => {
    (exchangeLoginCode as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 42, role, name: "Марія" });
    (findOrCreateCabinetUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-42",
      name: "Марія",
      email: "cabinet-42@users.jobs.skillklan.invalid",
    });

    await expect(authorize({ code: "C".repeat(43) })).resolves.toEqual({
      id: "u-42",
      name: "Марія",
      email: "cabinet-42@users.jobs.skillklan.invalid",
      cabinetUserId: 42,
      cabinetRole: role,
    });
    expect(exchangeLoginCode).toHaveBeenCalledWith("C".repeat(43));
  });

  it("a code the backend refused — no session, no account touched", async () => {
    (exchangeLoginCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (findOrCreateCabinetUser as ReturnType<typeof vi.fn>).mockClear();
    await expect(authorize({ code: "C".repeat(43) })).resolves.toBeNull();
    expect(findOrCreateCabinetUser).not.toHaveBeenCalled();
  });

  it("a non-string code is passed on as empty (and refused)", async () => {
    (exchangeLoginCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(authorize({ code: { nested: true } })).resolves.toBeNull();
    expect(exchangeLoginCode).toHaveBeenLastCalledWith("");
  });
});
