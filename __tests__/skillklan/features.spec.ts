// @vitest-environment node
// Requirement — the owner, 2026-10-16: Activities hidden behind a feature
// switch, off at launch; the admin sees what everyone sees (no exception for
// the admin). The list of switches is in code; the database holds only the
// admin's choices.
import {
  FEATURES,
  isFeatureKey,
  resolveFeatureFlags,
} from "@/skillklan/features";
import { SIDEBAR_LINKS, visibleSidebarLinks } from "@/lib/constants";

describe("resolveFeatureFlags", () => {
  it("no choice made → Activities off (the launch state)", () => {
    expect(resolveFeatureFlags([])).toEqual({ activities: false });
  });

  it("the admin's choice wins, both ways", () => {
    expect(resolveFeatureFlags([{ key: "activities", enabled: true }])).toEqual({ activities: true });
    expect(resolveFeatureFlags([{ key: "activities", enabled: false }])).toEqual({ activities: false });
  });

  it("a row for a switch no longer in the list is ignored, not an error", () => {
    expect(resolveFeatureFlags([{ key: "automations", enabled: true }])).toEqual({ activities: false });
  });

  it("only Activities exists today — a new switch is a decision, not a side effect", () => {
    expect(Object.keys(FEATURES)).toEqual(["activities"]);
  });
});

describe("isFeatureKey", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "%s (from the object prototype) is not a switch",
    (key) => expect(isFeatureKey(key)).toBe(false),
  );
  it("activities is", () => expect(isFeatureKey("activities")).toBe(true));
});

describe("visibleSidebarLinks — the menu for everyone, the admin included", () => {
  const routes = (links: typeof SIDEBAR_LINKS) => links.map((l) => l.route);

  it("Activities off → no Activities item, every other item stays", () => {
    const shown = routes(visibleSidebarLinks({ activities: false }, "production"));
    expect(shown).not.toContain("/dashboard/activities");
    expect(shown).toEqual([
      "/dashboard",
      "/dashboard/myjobs",
      "/dashboard/interviews",
      "/dashboard/automations",
      "/dashboard/tasks",
      "/dashboard/questions",
      "/dashboard/profile",
      "/dashboard/admin",
    ]);
  });

  it("Activities on → the item is back in its place", () => {
    const shown = routes(visibleSidebarLinks({ activities: true }, "production"));
    expect(shown.indexOf("/dashboard/activities")).toBe(shown.indexOf("/dashboard/tasks") + 1);
  });

  it("dev-only items stay out of production and show in development", () => {
    expect(routes(visibleSidebarLinks({ activities: true }, "production"))).not.toContain("/dashboard/developer");
    expect(routes(visibleSidebarLinks({ activities: true }, "development"))).toContain("/dashboard/developer");
  });
});
