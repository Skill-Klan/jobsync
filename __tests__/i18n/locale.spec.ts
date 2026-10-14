// @vitest-environment node
// Requirement — D29: the language comes from the cookie the switcher sets;
// no cookie, an unknown or a forged value — Ukrainian; outside a request
// (no cookies at all) — Ukrainian, not a crash.
vi.unmock("@/i18n/locale");
const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined, throws: false }));
vi.mock("next/headers", () => ({
  cookies: async () => {
    if (cookieStore.throws) throw new Error("cookies() was called outside a request scope");
    return { get: (name: string) => (name === "sk_locale" && cookieStore.value !== undefined ? { name, value: cookieStore.value } : undefined) };
  },
}));

import { getLocale } from "@/i18n/locale";
import { resolveLocale } from "@/i18n/config";

beforeEach(() => {
  cookieStore.value = undefined;
  cookieStore.throws = false;
});

describe("getLocale", () => {
  it("no cookie — Ukrainian", async () => {
    await expect(getLocale()).resolves.toBe("uk");
  });

  it("cookie en — English; cookie uk — Ukrainian", async () => {
    cookieStore.value = "en";
    await expect(getLocale()).resolves.toBe("en");
    cookieStore.value = "uk";
    await expect(getLocale()).resolves.toBe("uk");
  });

  it.each(["fr", "", "EN", "en-US", "uk;en", "toString"])("cookie %j — Ukrainian", async (value) => {
    cookieStore.value = value;
    await expect(getLocale()).resolves.toBe("uk");
  });

  it("outside a request — Ukrainian, no crash", async () => {
    cookieStore.throws = true;
    await expect(getLocale()).resolves.toBe("uk");
  });
});

describe("resolveLocale", () => {
  it("keeps only supported locales", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale(undefined)).toBe("uk");
    expect(resolveLocale(42)).toBe("uk");
  });
});
