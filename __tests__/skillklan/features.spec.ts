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

const ALL_OFF: FeatureFlags = { automations: false, activities: false, library: false, plans: false, tasks: false, catalog: false };
// What nobody has chosen yet: everything off except Tasks (2026-11-03: students
// already have Tasks, so the admin picks the moment to close it).
const LAUNCH: FeatureFlags = { ...ALL_OFF, tasks: true };
const ALL_ON: FeatureFlags = { automations: true, activities: true, library: true, plans: true, tasks: true, catalog: true };

describe("resolveFeatureFlags", () => {
  it("no choice made → Automations, Activities, the Library and the study plan off, Tasks on (the launch state)", () => {
    expect(resolveFeatureFlags([])).toEqual(LAUNCH);
  });

  it.each(["automations", "tasks", "activities", "library", "catalog", "plans"] as const)(
    "the admin's choice for %s wins, both ways, and touches no other switch",
    (key) => {
      expect(resolveFeatureFlags([{ key, enabled: true }])).toEqual({ ...LAUNCH, [key]: true });
      expect(resolveFeatureFlags([{ key, enabled: false }])).toEqual({ ...LAUNCH, [key]: false });
    },
  );

  it("a row for a switch no longer in the list is ignored, not an error", () => {
    expect(resolveFeatureFlags([{ key: "interviews", enabled: true }])).toEqual(LAUNCH);
  });

  it("exactly these six, in menu order — a new switch is a decision, not a side effect", () => {
    expect(Object.keys(FEATURES)).toEqual(["automations", "tasks", "activities", "library", "catalog", "plans"]);
  });
});

describe("isFeatureKey", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "%s (from the object prototype) is not a switch",
    (key) => expect(isFeatureKey(key)).toBe(false),
  );
  it.each(["automations", "tasks", "activities", "library", "catalog", "plans"])("%s is", (key) =>
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
    "/dashboard/plan",
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
    ["tasks", "/dashboard/tasks"],
    ["activities", "/dashboard/activities"],
    ["library", "/dashboard/admin"],
    ["plans", "/dashboard/plan"],
  ] as const)("%s off → only its item is gone (%s), every other item stays", (key, route) => {
    const shown = routes(visibleSidebarLinks({ ...ALL_ON, [key]: false }, "production"));
    expect(shown).toEqual(FULL_MENU.filter((r) => r !== route));
  });

  it("the launch state → the core only", () => {
    expect(routes(visibleSidebarLinks(LAUNCH, "production"))).toEqual([
      "/dashboard",
      "/dashboard/myjobs",
      "/dashboard/interviews",
      "/dashboard/tasks",
      "/dashboard/questions",
      "/dashboard/profile",
    ]);
    // Tasks closed too: the same menu without it
    expect(routes(visibleSidebarLinks(ALL_OFF, "production"))).toEqual([
      "/dashboard",
      "/dashboard/myjobs",
      "/dashboard/interviews",
      "/dashboard/questions",
      "/dashboard/profile",
    ]);
  });

  // Owner, 2026-11-02: «Навчальний план» for students, «Плани студентів» for
  // whoever manages SkillKlan Job — and the one switch `plans` covers both.
  it("«Плани студентів» is the admin's alone, and only while `plans` is on", () => {
    const adminMenu = (flags: FeatureFlags) => routes(visibleSidebarLinks(flags, "production", true));
    expect(adminMenu(ALL_ON)).toEqual([
      ...FULL_MENU.slice(0, FULL_MENU.indexOf("/dashboard/plan") + 1),
      "/dashboard/student-plans",
      ...FULL_MENU.slice(FULL_MENU.indexOf("/dashboard/plan") + 1),
      "/dashboard/catalog", // the admin's too, since `catalog` is on in ALL_ON
    ]);
    // a student, same switches: the student's page only
    expect(routes(visibleSidebarLinks(ALL_ON, "production", false))).toContain("/dashboard/plan");
    expect(routes(visibleSidebarLinks(ALL_ON, "production", false))).not.toContain("/dashboard/student-plans");
    // switch off: neither item, the admin included, every other item stays
    const off = adminMenu({ ...ALL_ON, plans: false });
    expect(off).not.toContain("/dashboard/plan");
    expect(off).not.toContain("/dashboard/student-plans");
    expect(off).toEqual([...FULL_MENU.filter((r) => r !== "/dashboard/plan"), "/dashboard/catalog"]);
  });

  // Owner, 2026-11-03: the catalog is managed by whoever manages SkillKlan Job
  // and by nobody else; its one switch `catalog` covers the menu item.
  it("«Каталог» is the admin's alone, and only while `catalog` is on", () => {
    const menu = (flags: FeatureFlags, admin: boolean) => routes(visibleSidebarLinks(flags, "production", admin));
    expect(menu(ALL_ON, true)).toContain("/dashboard/catalog");
    expect(menu(ALL_ON, false)).not.toContain("/dashboard/catalog");
    expect(menu({ ...ALL_ON, catalog: false }, true)).not.toContain("/dashboard/catalog");
    // the other items stay when it is off
    expect(menu({ ...ALL_ON, catalog: false }, false)).toEqual(FULL_MENU);
  });

  it("dev-only items stay out of production and show in development", () => {
    expect(routes(visibleSidebarLinks(ALL_ON, "production"))).not.toContain("/dashboard/developer");
    expect(routes(visibleSidebarLinks(ALL_ON, "development"))).toContain("/dashboard/developer");
  });
});
