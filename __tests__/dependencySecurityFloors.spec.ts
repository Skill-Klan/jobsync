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
  // WebSocket DoS (unrequested subprotocol, deflate error) and response
  // splitting through the retry interceptor.
  { pkg: "undici", min: "6.28.1", advisories: ["GHSA-rfgv-xxqx-mfg5", "GHSA-3wwx-pv8p-q78v", "GHSA-r53p-7pc4-xj5r"] },
  // Quadratic linkify paths: a few hundred KB of markdown blocks the event loop.
  { pkg: "markdown-it", min: "14.3.1", advisories: ["GHSA-253c-mchw-3w2r"] },
  // Uncontrolled resource consumption. Old copies came pinned by the
  // provider packages (@ai-sdk/openai, deepseek, google), not by `ai`.
  { pkg: "@ai-sdk/provider-utils", min: "4.0.33", advisories: ["GHSA-866g-f22w-33x8"] },
  // Dev tooling below: never in the image, but it runs on CI and on our machines.
  // CPU DoS: maxTotalMergeKeys did not bound empty merge sources.
  { pkg: "js-yaml", min: "4.3.2", advisories: ["GHSA-2883-xcg3-v3hh"] },
  // Arbitrary file read through a redirect mock path.
  { pkg: "vitest", min: "4.1.11", advisories: ["GHSA-82fw-gwwq-j7x9"] },
  { pkg: "@vitest/mocker", min: "4.1.11", advisories: ["GHSA-82fw-gwwq-j7x9"] },
];

// Packages present on more than one major, each with its own patched release.
const MAJOR_FLOORS: { pkg: string; major: number; min: string; advisories: string[] }[] = [
  // Quadratic `{a},b}` rewrite — CPU DoS.
  { pkg: "brace-expansion", major: 1, min: "1.1.21", advisories: ["GHSA-q2hr-2g5m-vwhr"] },
  { pkg: "brace-expansion", major: 5, min: "5.0.12", advisories: ["GHSA-q2hr-2g5m-vwhr"] },
  // mergeAttributes(): an own `__proto__` key from JSON swapped the merged
  // object's prototype, so inherited onerror/src reached the DOM. The advisory
  // lists 3.30.4 only, but 2.27.3 carries the same fix (defineProperty).
  { pkg: "@tiptap/core", major: 2, min: "2.27.3", advisories: ["GHSA-cp6q-959q-f8rh"] },
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

describe.each(MAJOR_FLOORS)("$pkg $major.x stays at or above $min ($advisories)", ({ pkg, major, min }) => {
  const onMajor = () => installed(pkg).filter(({ version }) => parse(version)[0] === major);

  it("is installed on this major at least once — otherwise this row checks nothing", () => {
    expect(onMajor().length).toBeGreaterThan(0);
  });

  it("has no copy on this major below the patched version", () => {
    expect(onMajor().filter(({ version }) => !atLeast(version, min))).toEqual([]);
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
