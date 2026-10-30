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

const nodeFroms = () =>
  read("Dockerfile")
    .split("\n")
    .filter((line) => /^FROM\s+node:/i.test(line));

describe("Node runtime version", () => {
  it("builds every Dockerfile stage on node:24 alpine, pinned by digest", () => {
    const froms = nodeFroms();
    // Anchor: the Dockerfile really has a node base stage to check.
    expect(froms.length).toBeGreaterThan(0);
    for (const line of froms) {
      expect(line).toMatch(
        new RegExp(`^FROM node:${NODE_MAJOR}\\.\\d+\\.\\d+-alpine@sha256:[0-9a-f]{64}\\b`),
      );
    }
  });

  // The undici behind global fetch: certificate check bypass through dropped
  // TLS options, crashes on TLS renegotiation and on too many content
  // encodings, unbounded EventSource and WebSocket PONG memory
  // (GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm, GHSA-xjj6-f33q-929c,
  // GHSA-4qv8-2p9j-2685, GHSA-9fm3-97px-rjf6). Fixed in undici 7.30.1, first
  // bundled by Node 24.22.1 — measured in the images: 24.22.0 still has 7.29.1.
  it("runs a Node whose bundled undici has the fixes (>= 24.22.1)", () => {
    const versions = nodeFroms().map((line) => {
      const v = line.match(/^FROM node:(\d+)\.(\d+)\.(\d+)-/i);
      expect(v).not.toBeNull();
      return v!.slice(1).map(Number);
    });
    expect(versions.length).toBeGreaterThan(0);
    for (const [major, minor, patch] of versions) {
      expect(major).toBe(24);
      expect(minor * 1000 + patch).toBeGreaterThanOrEqual(22 * 1000 + 1);
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

// npm 11 (bundled with Node 24) no longer installs optional peer
// dependencies from the lockfile. jsdom is only an optional peer of vitest,
// so on Node 24 `npm ci` left it out and 277 suites could not start. Whatever
// vitest.config names as its environment must be a direct devDependency.
describe("test environment package", () => {
  it("is a direct devDependency, not an optional peer of vitest", () => {
    const env = read("vitest.config.ts").match(/environment:\s*["']([\w-]+)["']/)?.[1];
    expect(env).toBe("jsdom");
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.devDependencies[env!]).toBeDefined();
  });
});
