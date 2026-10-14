// @vitest-environment node
// The app runs on Node 24 LTS (owner's decision, 2026-10-14): Node 20 reached
// end of life on 2026-04-30 and gets no more security fixes — for Node itself
// and for the undici it bundles behind global fetch. Dependabot only reads
// package-lock.json, so nothing else would notice the base image going stale.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const NODE_MAJOR = 24;

describe("Node runtime version", () => {
  it("builds every Dockerfile stage on node:24 alpine, pinned by digest", () => {
    const froms = read("Dockerfile")
      .split("\n")
      .filter((line) => /^FROM\s+node:/i.test(line));
    // Anchor: the Dockerfile really has a node base stage to check.
    expect(froms.length).toBeGreaterThan(0);
    for (const line of froms) {
      expect(line).toMatch(
        new RegExp(`^FROM node:${NODE_MAJOR}\\.\\d+\\.\\d+-alpine@sha256:[0-9a-f]{64}\\b`),
      );
    }
  });

  it("runs CI on the same Node major as the image", () => {
    const versions = [...read(".github/workflows/ci.yml").matchAll(/node-version:\s*["']?([\w.]+)/g)].map(
      (m) => m[1],
    );
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) expect(Number(v.split(".")[0])).toBe(NODE_MAJOR);
  });

  it("type-checks against the same Node major", () => {
    const pkg = JSON.parse(read("package.json"));
    const range: string = pkg.devDependencies["@types/node"];
    expect(Number(range.replace(/^[^\d]*/, "").split(".")[0])).toBe(NODE_MAJOR);
  });
});
