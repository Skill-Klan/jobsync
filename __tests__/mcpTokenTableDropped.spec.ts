// @vitest-environment node
// The MCP server is gone (decision D7a), so its token table goes too. These
// tests run the real migration history with the Prisma CLI — the same
// `migrate deploy` the image entrypoint runs on every start.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "..");
const PRISMA_DIR = path.join(ROOT, "prisma");
const TABLE = ["Mcp", "AccessToken"].join("");
// The newest migration on main before the drop: a database at this point is
// what an existing install looks like when it upgrades.
const LAST_BEFORE_DROP = "20261002141429_company_notes_size_linkedin";

function prisma(args: string[], url: string): string {
  return execFileSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  }).toString();
}

// A schema + migrations folder of its own, so migrate deploy can be pointed
// at a prefix of the history.
function stageMigrations(dir: string, keep: (name: string) => boolean): string {
  const target = path.join(dir, "prisma");
  fs.mkdirSync(path.join(target, "migrations"), { recursive: true });
  fs.copyFileSync(path.join(PRISMA_DIR, "schema.prisma"), path.join(target, "schema.prisma"));
  const migrations = path.join(PRISMA_DIR, "migrations");
  for (const name of fs.readdirSync(migrations)) {
    const from = path.join(migrations, name);
    if (fs.statSync(from).isDirectory()) {
      if (keep(name)) fs.cpSync(from, path.join(target, "migrations", name), { recursive: true });
    } else {
      fs.copyFileSync(from, path.join(target, "migrations", name));
    }
  }
  return path.join(target, "schema.prisma");
}

async function tables(url: string): Promise<string[]> {
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    return rows.map((r) => r.name);
  } finally {
    await client.$disconnect();
  }
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-mcp-drop-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("McpAccessToken table is dropped (D7a)", () => {
  it("does not exist on a fresh database after all migrations", async () => {
    const url = `file:${path.join(dir, "fresh.db")}`;
    prisma(["migrate", "deploy"], url);
    const names = await tables(url);
    expect(names).toContain("User");
    expect(names).not.toContain(TABLE);
  }, 120_000);

  it("is dropped on upgrade without touching the users", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    const before = stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE_DROP);
    prisma(["migrate", "deploy", "--schema", before], url);

    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      await client.$executeRawUnsafe(
        `INSERT INTO "User" (id, name, email, password) VALUES ('u1', 'Student', 's@example.com', 'x')`,
      );
      await client.$executeRawUnsafe(
        `INSERT INTO "${TABLE}" (id, userId, name, tokenHash, tokenPrefix, scopes, expiresAt) VALUES ('t1', 'u1', 'cli', 'hash', 'js_', '[]', CURRENT_TIMESTAMP)`,
      );
    } finally {
      await client.$disconnect();
    }
    expect(await tables(url)).toContain(TABLE);

    prisma(["migrate", "deploy"], url);

    expect(await tables(url)).not.toContain(TABLE);
    const after = new PrismaClient({ datasources: { db: { url } } });
    try {
      const users = await after.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "User"`);
      expect(users.map((u) => u.id)).toEqual(["u1"]);
    } finally {
      await after.$disconnect();
    }
  }, 120_000);

  // Schema and migration history must describe the same database, or the
  // next `migrate dev` writes a surprise migration of its own.
  it("leaves no drift between schema.prisma and the migration history", () => {
    const shadow = `file:${path.join(dir, "shadow.db")}`;
    const out = prisma(
      [
        "migrate",
        "diff",
        "--from-migrations",
        path.join(PRISMA_DIR, "migrations"),
        "--to-schema-datamodel",
        path.join(PRISMA_DIR, "schema.prisma"),
        "--shadow-database-url",
        shadow,
        "--script",
      ],
      shadow,
    );
    expect(out).toMatch(/This is an empty migration/);
  }, 120_000);

  it("exposes no client delegate for the dropped table", () => {
    const client = new PrismaClient();
    expect("mcpAccessToken" in client).toBe(false);
  });
});
