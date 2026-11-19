// Requirement — the owner, 2026-11-19 (SKD-58): the feature switches grow in
// number, so Settings → «Функції» must be a catalog — grouped, one short line
// per switch, the long text on request — and every switch must carry its
// texts in both languages.
import { render, screen, within } from "@testing-library/react";
import FeatureSettings from "@/components/settings/FeatureSettings";
import { FEATURE_GROUPS, FEATURE_KEYS, FEATURES, featuresInGroup, resolveFeatureFlags } from "@/skillklan/features";
import { MESSAGES } from "@/i18n/messages";

vi.mock("@/actions/featureToggles.actions", () => ({ setFeatureEnabled: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

describe("every switch is catalogued", () => {
  it.each(["uk", "en"] as const)("%s: a label, a short summary and a description for each switch, a name for each group", (lang) => {
    const f = (MESSAGES[lang] as any).settings.features;
    for (const key of FEATURE_KEYS) {
      for (const field of ["label", "summary", "description"]) {
        expect(f.items[key][field], `${key}.${field}`).toEqual(expect.stringMatching(/\S/));
      }
      // The summary is a line, the description the longer text.
      expect(f.items[key].summary.length, key).toBeLessThan(f.items[key].description.length);
    }
    for (const group of FEATURE_GROUPS) expect(f.groups[group], group).toEqual(expect.stringMatching(/\S/));
  });

  it("each switch is in exactly one known group, and no group is empty", () => {
    for (const key of FEATURE_KEYS) expect(FEATURE_GROUPS).toContain(FEATURES[key].group);
    expect(FEATURE_GROUPS.flatMap(featuresInGroup).sort()).toEqual([...FEATURE_KEYS].sort());
    for (const group of FEATURE_GROUPS) expect(featuresInGroup(group).length).toBeGreaterThan(0);
  });
});

describe("Settings → Features (English)", () => {
  const renderIt = (enabled: boolean) =>
    render(<FeatureSettings initial={{ ...resolveFeatureFlags([]), ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, enabled])) } as any} />);

  it("lists the switches under their groups, each with a switch and its summary", () => {
    renderIt(false);
    for (const group of FEATURE_GROUPS) {
      const section = screen.getByRole("region", { name: (MESSAGES.en as any).settings.features.groups[group] });
      expect(within(section).getAllByRole("switch")).toHaveLength(featuresInGroup(group).length);
    }
    expect(screen.getAllByRole("switch")).toHaveLength(FEATURE_KEYS.length);
    expect(screen.getByText((MESSAGES.en as any).settings.features.items.tasks.summary)).toBeInTheDocument();
  });

  it("the group counter follows the switches (paired: all off, all on)", () => {
    const { unmount } = renderIt(false);
    expect(screen.getAllByText(/^0 of \d+ on$/)).toHaveLength(FEATURE_GROUPS.length);
    unmount();
    renderIt(true);
    expect(screen.getAllByText(/^(\d+) of \1 on$/)).toHaveLength(FEATURE_GROUPS.length);
  });
});
