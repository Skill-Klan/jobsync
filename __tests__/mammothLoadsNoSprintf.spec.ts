// @vitest-environment node
// sprintf-js (GHSA-hp3w-g68c-fv3c: unbounded precision -> RangeError) has no
// patched release. It reaches the tree only as mammoth -> argparse@1 ->
// sprintf-js, and argparse is used by mammoth's CLI (bin/mammoth), never by
// the library we call in src/lib/ai/import/extract-text.ts. On that basis the
// Dependabot alert is dismissed as "vulnerable code not used" (owner,
// 2026-10-14). This test keeps the basis true: if a mammoth update starts
// loading argparse or sprintf-js from the library, it fails and the alert
// has to be reopened.
import { spawnSync } from "child_process";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// A fresh Node process, so nothing another test loaded can hide or fake it.
function modulesLoadedBy(entry: string): string[] {
  const script = `
    const before = new Set(Object.keys(require.cache));
    require(${JSON.stringify(entry)});
    process.stdout.write(JSON.stringify(Object.keys(require.cache).filter((k) => !before.has(k))));
  `;
  const r = spawnSync(process.execPath, ["-e", script], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

describe("mammoth library (DOCX import)", () => {
  it("does not load argparse or sprintf-js", () => {
    const loaded = modulesLoadedBy("mammoth");
    // Anchor: the probe really loaded mammoth itself.
    expect(loaded.some((f) => f.includes(`${path.sep}mammoth${path.sep}lib${path.sep}`))).toBe(true);
    expect(loaded.filter((f) => /[\\/]node_modules[\\/](argparse|sprintf-js)[\\/]/.test(f))).toEqual([]);
  });

  // The pair: the same probe does see sprintf-js when argparse@1 is loaded,
  // so an empty list above is a real "not loaded", not a blind probe.
  it("would see sprintf-js if mammoth's argparse were loaded", () => {
    const loaded = modulesLoadedBy("mammoth/node_modules/argparse");
    expect(loaded.some((f) => /[\\/]node_modules[\\/]sprintf-js[\\/]/.test(f))).toBe(true);
  });
});
