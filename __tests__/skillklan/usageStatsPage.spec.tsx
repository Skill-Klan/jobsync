// Requirement — the owner, 2026-11-22 (SKD-66): only the admin sees the
// statistics. For anyone else the page does not exist: a 404, not an empty page.
import { render, screen } from "@testing-library/react";

const ctx = vi.hoisted(() => ({ stats: null as unknown }));
vi.mock("@/actions/usageStats.actions", () => ({ getUsageStats: vi.fn(async () => ctx.stats) }));
vi.mock("@/components/stats/UsageStats", () => ({ default: () => <p>numbers</p> }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import Stats from "@/app/dashboard/stats/page";

describe("the statistics page", () => {
  it("not an admin → 404", async () => {
    ctx.stats = null;
    await expect(Stats()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("an admin sees the numbers (paired case)", async () => {
    ctx.stats = { summary: {}, people: [] };
    render(await Stats());
    expect(screen.getByText("numbers")).toBeInTheDocument();
  });
});
