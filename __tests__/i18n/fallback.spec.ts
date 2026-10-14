// @vitest-environment node
// Requirement: a text missing in the current language shows its English
// version, never a raw key; a key that does not exist anywhere shows the key
// (so it is visible in review) — and prototype names are not "found".
import { fallbackMessage } from "@/i18n/fallback";

describe("fallbackMessage", () => {
  it("missing in uk — the English text", () => {
    expect(fallbackMessage({ namespace: "nav", key: "jobs" })).toBe("Jobs");
  });

  it("nested key without a namespace", () => {
    expect(fallbackMessage({ key: "nav.dashboard" })).toBe("Dashboard");
  });

  it("unknown key — the key itself", () => {
    expect(fallbackMessage({ namespace: "nav", key: "nope" })).toBe("nav.nope");
  });

  it("prototype names are not messages", () => {
    expect(fallbackMessage({ namespace: "nav", key: "toString" })).toBe("nav.toString");
    expect(fallbackMessage({ key: "constructor" })).toBe("constructor");
    // through the prototype chain a path can end on a real string ("Object") — still not a message
    expect(fallbackMessage({ key: "constructor.name" })).toBe("constructor.name");
    expect(fallbackMessage({ namespace: "nav", key: "toString.name" })).toBe("nav.toString.name");
  });

  it("a namespace (object) is not a message", () => {
    expect(fallbackMessage({ key: "nav" })).toBe("nav");
  });
});
