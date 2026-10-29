// @vitest-environment node
//
// Requirements for the shared instructions (owner, 2026-10-29: a second developer works here with an AI agent;
// the instructions are read-only for that agent; changes to them, to CI/deploy, migrations and dependencies
// need the owner's review — D84, D87):
//   G1  the shared docs leak nothing: no local machine paths, no notes folder of the owner's machine, no
//       Telegram chat ids, no private keys or tokens — each detector is shown to catch a sample first
//   G2  the agent may not edit its own instructions, CI or deploy files (deny rules in .claude/settings.json)
//   G3  CODEOWNERS covers instructions, docs, CI and deploy, migrations, dependencies and the license
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

// Built from parts, so that a search of the repository for these strings never finds this file.
const OWNER_NOTES = ["_projects", "base"].join("-");
const DETECTORS: { what: string; pattern: RegExp; sample: string }[] = [
  { what: "a macOS home path", pattern: /\/Users\/[^/\s]+/, sample: ["", "Users", "someone", "x"].join("/") },
  { what: "a Linux home path", pattern: /\/home\/[a-z_][a-z0-9_-]*\//, sample: ["", "home", "someone", "x"].join("/") },
  { what: "a Windows profile path", pattern: /[A-Za-z]:\\Users\\/, sample: ["C:", "Users", "x"].join("\\") },
  { what: "a Desktop folder", pattern: /Desktop\/[A-Z]/, sample: ["Desktop", "Roman"].join("/") },
  { what: "the owner's notes folder", pattern: new RegExp(OWNER_NOTES), sample: `see ${OWNER_NOTES}/wiki` },
  { what: "a Telegram chat id", pattern: /-100\d{9,}/, sample: ["-100", "1234567890"].join("") },
  { what: "a private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, sample: ["-----BEGIN", "OPENSSH PRIVATE KEY-----"].join(" ") },
  { what: "a GitHub token", pattern: /\b(ghp|gho|ghs)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, sample: ["ghp", "a".repeat(36)].join("_") },
  { what: "an Anthropic key", pattern: /sk-ant-[A-Za-z0-9_-]{10,}/, sample: ["sk", "ant", "a".repeat(20)].join("-") },
  { what: "a Telegram bot token", pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, sample: `123456789:${"A".repeat(35)}` },
  {
    what: "a secret with its value",
    pattern: /\b[A-Z][A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY)\s*=\s*["']?[^\s"'<>]{12,}/,
    sample: "JOBSYNC_API_" + "SECRET=" + "x".repeat(40),
  },
];

// What other people and their agents read: tracked files plus new ones not yet added (ignored files — a
// personal .claude/CLAUDE.md, agent worktrees — are not shared and not scanned).
function sharedFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "CLAUDE.md", "CONTRIBUTING.md", "README.md", "docs", ".claude"],
    { cwd: root, encoding: "utf8" },
  );
  return out.split("\n").filter((f) => f && fs.existsSync(path.join(root, f)));
}

describe("G1 the shared docs leak nothing", () => {
  it.each(DETECTORS)("the detector for $what catches a sample", ({ pattern, sample }) => {
    expect(pattern.test(sample)).toBe(true);
  });

  it("scans the shared files and finds nothing", () => {
    const files = sharedFiles();
    // The scan reached the files that matter — otherwise "nothing found" would mean nothing was read.
    expect(files).toEqual(expect.arrayContaining(["CLAUDE.md", "CONTRIBUTING.md", "docs/contracts/backend-login.md", ".claude/settings.json"]));
    expect(files.some((f) => f.startsWith(".claude/rules/"))).toBe(true);

    const leaks = files.flatMap((file) =>
      read(file)
        .split("\n")
        .flatMap((line, i) => DETECTORS.filter((d) => d.pattern.test(line)).map((d) => `${file}:${i + 1} — ${d.what}`)),
    );
    expect(leaks).toEqual([]);
  });
});

describe("G2 the agent cannot edit its own instructions, CI or deploy", () => {
  const settings = JSON.parse(read(".claude/settings.json"));
  const deny: string[] = settings.permissions.deny;

  it.each(["/CLAUDE.md", "/.claude/rules/**", "/.claude/settings.json", "/.github/**", "/skillklan/deploy/**", "/LICENSE"])(
    "%s is denied to both Edit and Write",
    (target) => {
      expect(deny).toEqual(expect.arrayContaining([`Edit(${target})`, `Write(${target})`]));
    },
  );

  it("local env files are not read", () => {
    expect(deny).toEqual(expect.arrayContaining(["Read(/.env)", "Read(/.env.local)"]));
  });

  it("the rules files are real path-scoped rules", () => {
    const rules = fs.readdirSync(path.join(root, ".claude/rules")).filter((f) => f.endsWith(".md"));
    expect(rules.length).toBeGreaterThanOrEqual(6);
    for (const file of rules) {
      expect(read(`.claude/rules/${file}`)).toMatch(/^---\npaths:\n( {2}- "[^"]+"\n)+---\n/);
    }
  });
});

describe("G3 CODEOWNERS sends these to the owner", () => {
  const owners = new Map(
    read(".github/CODEOWNERS")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.trim().split(/\s+/) as [string, ...string[]])
      .map(([pattern, ...who]) => [pattern, who]),
  );

  it.each([
    "/CLAUDE.md",
    "/.claude/",
    "/docs/",
    "/.github/",
    "/skillklan/",
    "/prisma/migrations/",
    "/prisma/schema.prisma",
    "/package.json",
    "/package-lock.json",
    "/LICENSE",
  ])("%s is owned by the owner", (pattern) => {
    expect(owners.get(pattern)).toEqual(["@Skill-Klan"]);
  });
});
