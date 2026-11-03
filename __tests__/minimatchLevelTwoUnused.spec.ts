// @vitest-environment node
// minimatch (GHSA-g3hv-75wg-m249: at optimizationLevel >= 2 each `**/..`
// split doubles the pattern set, which is then compared pairwise -> CPU and
// memory DoS) is fixed only in 11.0.1. Our copies come from eslint (^3) and
// @typescript-eslint/typescript-estree (^10.2.2), and neither accepts 11.
// 3.x has no level-2 code at all; 10.x has it, but it runs only when the
// caller passes optimizationLevel >= 2, and no caller does: typescript-estree
// matches allowDefaultProject globs at the default level 1. Both copies are
// dev tooling, outside the image. On that basis the Dependabot alert is
// dismissed as "vulnerable code not used" (owner, 2026-11-03). This test
// keeps the basis true: if a copy below the fix becomes a runtime dependency,
// or a package that calls minimatch starts passing optimizationLevel, it
// fails and the alert has to be reopened.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const FIXED = "11.0.1";

const lock = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"),
) as {
  packages: Record<
    string,
    {
      version?: string;
      dev?: boolean;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    }
  >;
};

function below(version: string, min: string): boolean {
  const a = version.split(/[-+]/)[0].split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

const copies = Object.entries(lock.packages).filter(
  ([at]) =>
    at === "node_modules/minimatch" || at.endsWith("/node_modules/minimatch"),
);

// Every package that declares minimatch — the only code that can call it.
// The root project would be our own src.
const callers = Object.entries(lock.packages)
  .filter(([, meta]) =>
    [meta.dependencies, meta.optionalDependencies, meta.peerDependencies].some(
      (deps) => deps && "minimatch" in deps,
    ),
  )
  .map(([at]) => (at === "" ? "src" : at));

// Source files of one package, without the packages nested in it: those are
// in the lock on their own and checked only if they declare minimatch.
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") out.push(...sourceFiles(full));
    } else if (
      /\.(c|m)?[jt]sx?$/.test(entry.name) &&
      !/\.d\.(c|m)?ts$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function filesMentioning(dirs: string[], text: string | RegExp): string[] {
  return dirs
    .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
    .filter((file) => {
      const code = fs.readFileSync(file, "utf8");
      return typeof text === "string" ? code.includes(text) : text.test(code);
    })
    .map((file) => path.relative(ROOT, file));
}

describe(`minimatch below ${FIXED} (GHSA-g3hv-75wg-m249, alert dismissed)`, () => {
  it("is never a runtime dependency", () => {
    expect(copies.length).toBeGreaterThan(0);
    const runtime = copies.filter(
      ([, meta]) => below(meta.version ?? "0.0.0", FIXED) && meta.dev !== true,
    );
    expect(runtime.map(([at, meta]) => `${at}@${meta.version}`)).toEqual([]);
  });

  it("is never called with optimizationLevel", () => {
    // Anchor: the scan reaches the caller of the 10.x copy and sees its call.
    expect(callers).toContain(
      "node_modules/@typescript-eslint/typescript-estree",
    );
    expect(
      filesMentioning(
        ["node_modules/@typescript-eslint/typescript-estree"],
        /require\("minimatch"\)|from "minimatch"/,
      ),
    ).not.toEqual([]);

    expect(filesMentioning(callers, "optimizationLevel")).toEqual([]);
  });

  // The pair: the same scan does find the option in minimatch itself, so an
  // empty list above is a real "not passed", not a blind search.
  it("would see optimizationLevel where it is written", () => {
    expect(
      filesMentioning(
        copies.map(([at]) => at),
        "optimizationLevel",
      ),
    ).not.toEqual([]);
  });
});
