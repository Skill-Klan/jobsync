// @vitest-environment node
// Requirement — the owner, 2026-10-16: Activities hidden behind a feature
// switch, off at launch; the admin sees what everyone sees (no exception for
// the admin). 2026-10-18 (D73, D74): Automations and the Library behind
// switches "on the same principle", both off at launch. The list of switches
// is in code; the database holds only the admin's choices.
import {
  FEATURES,
  isFeatureKey,
  resolveFeatureFlags,
  type FeatureFlags,
} from "@/skillklan/features";
import { SIDEBAR_LINKS, visibleSidebarLinks } from "@/lib/constants";

const ALL_OFF: FeatureFlags = { automations: false, activities: false, library: false };
const ALL_ON: FeatureFlags = { automations: true, activities: true, library: true };

describe("resolveFeatureFlags", () => {
  it("no choice made → Automations, Activities and the Library all off (the launch state)", () => {
    expect(resolveFeatureFlags([])).toEqual(ALL_OFF);
  });

  it.each(["automations", "activities", "library"] as const)(
    "the admin's choice for %s wins, both ways, and touches no other switch",
    (key) => {
      expect(resolveFeatureFlags([{ key, enabled: true }])).toEqual({ ...ALL_OFF, [key]: true });
      expect(resolveFeatureFlags([{ key, enabled: false }])).toEqual(ALL_OFF);
    },
  );

  it("a row for a switch no longer in the list is ignored, not an error", () => {
    expect(resolveFeatureFlags([{ key: "interviews", enabled: true }])).toEqual(ALL_OFF);
  });

  it("exactly these three, in menu order — a new switch is a decision, not a side effect", () => {
    expect(Object.keys(FEATURES)).toEqual(["automations", "activities", "library"]);
  });
});

describe("isFeatureKey", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "%s (from the object prototype) is not a switch",
    (key) => expect(isFeatureKey(key)).toBe(false),
  );
  it.each(["automations", "activities", "library"])("%s is", (key) =>
    expect(isFeatureKey(key)).toBe(true),
  );
});

describe("visibleSidebarLinks — the menu for everyone, the admin included", () => {
  const routes = (links: typeof SIDEBAR_LINKS) => links.map((l) => l.route);
  const FULL_MENU = [
    "/dashboard",
    "/dashboard/myjobs",
    "/dashboard/interviews",
    "/dashboard/automations",
    "/dashboard/tasks",
    "/dashboard/activities",
    "/dashboard/questions",
    "/dashboard/profile",
    "/dashboard/admin",
  ];

  it("everything on → the full menu, in its order", () => {
    expect(routes(visibleSidebarLinks(ALL_ON, "production"))).toEqual(FULL_MENU);
  });

  it.each([
    ["automations", "/dashboard/automations"],
    ["activities", "/dashboard/activities"],
    ["library", "/dashboard/admin"],
  ] as const)("%s off → only its item is gone (%s), every other item stays", (key, route) => {
    const shown = routes(visibleSidebarLinks({ ...ALL_ON, [key]: false }, "production"));
    expect(shown).toEqual(FULL_MENU.filter((r) => r !== route));
  });

  it("the launch state → the core only", () => {
    expect(routes(visibleSidebarLinks(ALL_OFF, "production"))).toEqual([
      "/dashboard",
      "/dashboard/myjobs",
      "/dashboard/interviews",
      "/dashboard/tasks",
      "/dashboard/questions",
      "/dashboard/profile",
    ]);
  });

  it("dev-only items stay out of production and show in development", () => {
    expect(routes(visibleSidebarLinks(ALL_ON, "production"))).not.toContain("/dashboard/developer");
    expect(routes(visibleSidebarLinks(ALL_ON, "development"))).toContain("/dashboard/developer");
  });
});
