// @vitest-environment node
// Requirement — D29: the switcher stores the choice for a year, readable by
// the server only; a value that is not a supported language is not stored.
const set = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

import { setLocale } from "@/i18n/actions";

beforeEach(() => set.mockReset());

describe("setLocale", () => {
  it.each(["en", "uk"])("%s — stored in the cookie for a year", async (locale) => {
    await expect(setLocale(locale)).resolves.toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("sk_locale", locale, expect.objectContaining({
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: true,
    }));
  });

  it.each(["fr", "", "en-US", "<script>", "toString"])("%j — not stored", async (locale) => {
    await expect(setLocale(locale)).resolves.toBe(false);
    expect(set).not.toHaveBeenCalled();
  });
});
