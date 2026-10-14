// @vitest-environment node
// Security fixes we have shipped, pinned as floors on what the lockfile
// actually installs. Each row is one Dependabot advisory we closed: a
// version below the floor anywhere in the tree means the fix was lost —
// typically to a lockfile regeneration or a careless downgrade.
import fs from "fs";
import path from "path";

type Floor = {
  pkg: string;
  // First patched version, from the advisory — not from what is installed.
  min: string;
  advisories: string[];
};

const FLOORS: Floor[] = [
  // Cache poisoning of SSG/ISR pages, cross-user content substitution.
  { pkg: "next", min: "15.5.27", advisories: ["GHSA-4jqv-mc3x-m676", "GHSA-mcj8-r9mp-w47p"] },
  // XSS when attacker-provided HTML is pasted into the editor.
  { pkg: "prosemirror-view", min: "1.42.3", advisories: ["GHSA-c8x8-7fp4-3x9w"] },
  // Bundled libheif and librsvg: memory bugs, possible RCE on untrusted images.
  { pkg: "sharp", min: "0.35.5", advisories: ["GHSA-rgj7-g3m4-5g8c", "GHSA-wq5f-xc86-pv6w"] },
  // Event-loop DoS from huge section offsets in an indexed source map.
  { pkg: "source-map-js", min: "1.2.2", advisories: ["GHSA-68fv-2mgg-jv7q"] },
];

const lock = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package-lock.json"), "utf8"),
) as { packages: Record<string, { version?: string }> };

function parse(version: string): number[] {
  const core = version.split(/[-+]/)[0];
  return core.split(".").map((n) => Number(n));
}

function atLeast(version: string, min: string): boolean {
  const a = parse(version);
  const b = parse(min);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

function installed(pkg: string): { at: string; version: string }[] {
  return Object.entries(lock.packages)
    .filter(([at]) => at === `node_modules/${pkg}` || at.endsWith(`/node_modules/${pkg}`))
    .map(([at, meta]) => ({ at, version: meta.version ?? "" }));
}

describe("atLeast", () => {
  it("compares numerically, not as strings", () => {
    expect(atLeast("15.5.27", "15.5.27")).toBe(true);
    expect(atLeast("15.5.100", "15.5.27")).toBe(true);
    expect(atLeast("15.5.9", "15.5.27")).toBe(false);
    expect(atLeast("15.5.26", "15.5.27")).toBe(false);
    expect(atLeast("16.0.0", "15.5.27")).toBe(true);
  });
});

describe.each(FLOORS)("$pkg stays at or above $min ($advisories)", ({ pkg, min }) => {
  it("is installed at least once — otherwise this row checks nothing", () => {
    expect(installed(pkg).length).toBeGreaterThan(0);
  });

  it("has no copy below the patched version", () => {
    const below = installed(pkg).filter(({ version }) => !atLeast(version, min));
    expect(below).toEqual([]);
  });
});
