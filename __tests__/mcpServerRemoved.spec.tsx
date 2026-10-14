// SkillKlan Job ships without the MCP server: the owner decided to cut it out
// completely (decision D7a). These tests pin that requirement down — no
// endpoint, no auth-middleware exemption, no SDK dependency, no settings
// section, no leftover config knobs — so it cannot creep back in a merge.
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import SettingsSidebar from "@/components/settings/SettingsSidebar";
import DataSettings from "@/components/settings/DataSettings";
import { APP_CONSTANTS } from "@/lib/constants";
import { config as middlewareConfig } from "@/middleware";

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Assembled from parts so this file never matches its own scan if the scan
// is ever widened to __tests__.
const SDK = ["@modelcontextprotocol", "sdk"].join("/");
const FORBIDDEN_IMPORTS = [
  ["@modelcontextprotocol", ""].join("/"),
  ["@/lib", "mcp"].join("/"),
  ["@/models", "mcp.schema"].join("/"),
  ["mcpToken", "actions"].join("."),
  ["Mcp", "AccessSettings"].join(""),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("MCP server is removed (D7a)", () => {
  it("has no /api/mcp route and no MCP library in the app", () => {
    expect(existsSync(path.join(SRC, "app/api/mcp"))).toBe(false);
    expect(existsSync(path.join(SRC, "lib/mcp"))).toBe(false);
  });

  // The matcher used to read /api/((?!auth|mcp).*): the MCP endpoint did its
  // own bearer-token auth. With it gone, nothing but NextAuth's own routes
  // may skip the session middleware.
  it("puts every /api path except /api/auth behind the session middleware", () => {
    const covers = (p: string) =>
      middlewareConfig.matcher.some((m) => new RegExp(`^${m}$`).test(p));
    expect(covers("/api/mcp")).toBe(true);
    expect(covers("/api/jobs/export")).toBe(true);
    expect(covers("/api/auth/session")).toBe(false);
  });

  it("does not depend on the MCP SDK", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies?.[SDK]).toBeUndefined();
    expect(pkg.devDependencies?.[SDK]).toBeUndefined();
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.packages[`node_modules/${SDK}`]).toBeUndefined();
  });

  it("has no source file importing the SDK or the removed MCP modules", () => {
    const files = walk(SRC);
    // Anchor: the walk really reached the module that used to import the
    // MCP schema, so an empty or wrong walk cannot pass as "no hits".
    expect(files).toContain(path.join(SRC, "models/agent.schema.ts"));
    const hits = files.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return FORBIDDEN_IMPORTS.filter((s) => text.includes(s)).map(
        (s) => `${path.relative(ROOT, f)}: ${s}`,
      );
    });
    expect(hits).toEqual([]);
  });

  it("keeps no MCP_* settings in APP_CONSTANTS", () => {
    expect(Object.keys(APP_CONSTANTS).filter((k) => k.startsWith("MCP_"))).toEqual([]);
  });

  it("offers no MCP_ENABLED switch in the example env or the image smoke test", () => {
    expect(read(".env.example")).not.toMatch(/MCP_ENABLED/);
    expect(read("skillklan/tests/image-smoke.sh")).not.toMatch(/MCP_ENABLED/);
  });

  it("shows no MCP Access section in settings", () => {
    render(<SettingsSidebar activeSection="ai-provider" onSectionChange={() => {}} />);
    expect(screen.getByRole("button", { name: "AI Provider" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mcp/i })).toBeNull();
  });

  it("does not mention MCP tokens on the data settings page", () => {
    const { container } = render(<DataSettings />);
    expect(container.textContent).toMatch(/no API keys/i);
    expect(container.textContent).not.toMatch(/MCP/);
  });
});
