// Requirement — the owner, 2026-10-18 (D71, D72): SkillKlan Job opens in the
// cabinet's own tab, and its menu has «Кабінет» to go back in one click,
// however many pages were opened in Job. In the side menu and in the phone
// menu; to the server's CABINET_URL (the address the sign-in trusts), in this
// same tab. No address, or not an http(s) one → no item (never a «javascript:»
// link).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => ({ activities: false })) }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/dashboard/interviews") }));
vi.mock("@/context/NotificationContext", () => ({
  useNotifications: () => ({ summary: { unread: 0, unreadErrors: 0 }, refresh: vi.fn() }),
}));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { cabinetLink } from "@/skillklan/cabinetLink";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { SidebarProvider } from "@/context/SidebarContext";

const CABINET = "https://app.skillklan.com.ua/";
const user = { id: "1", name: "Test User", email: "test@example.invalid" };

afterEach(() => {
  delete process.env.CABINET_URL;
});

describe("the cabinet's address", () => {
  it.each([
    ["https://app.skillklan.com.ua", "https://app.skillklan.com.ua/"],
    ["  https://app.skillklan.com.ua/  ", "https://app.skillklan.com.ua/"],
    ["http://localhost:5173", "http://localhost:5173/"],
  ])("%j → %s", (raw, link) => {
    expect(cabinetLink({ CABINET_URL: raw })).toBe(link);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["a script", "javascript:alert(1)"],
    ["not an address", "app.skillklan.com.ua"],
    ["another scheme", "ftp://app.skillklan.com.ua"],
  ])("%s → no link", (_label, raw) => {
    expect(cabinetLink({ CABINET_URL: raw })).toBeNull();
  });
});

describe("the side menu", () => {
  const renderSidebar = (cabinetUrl: string | null) =>
    render(
      <SidebarProvider initialExpanded>
        <Sidebar user={user} signOutAction={() => {}} cabinetUrl={cabinetUrl} />
      </SidebarProvider>,
    );

  it("«Cabinet» goes to the cabinet in this same tab", () => {
    renderSidebar(CABINET);
    const link = screen.getByRole("link", { name: "Cabinet" });
    expect(link).toHaveAttribute("href", CABINET);
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("no address → no item; the rest of the menu is there", () => {
    renderSidebar(null);
    expect(screen.queryByRole("link", { name: "Cabinet" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interviews" })).toBeInTheDocument();
  });
});

describe("the phone menu", () => {
  const openMenu = async () => {
    render(await Header());
    await userEvent.setup().click(screen.getByRole("button", { name: "Toggle Menu" }));
  };

  it("«Cabinet» goes to the cabinet in this same tab", async () => {
    process.env.CABINET_URL = "https://app.skillklan.com.ua";
    await openMenu();
    const link = screen.getByRole("link", { name: "Cabinet" });
    expect(link).toHaveAttribute("href", CABINET);
    expect(link).not.toHaveAttribute("target");
  });

  it("no address → no item; the rest of the menu is there", async () => {
    await openMenu();
    expect(screen.queryByRole("link", { name: "Cabinet" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interviews" })).toBeInTheDocument();
  });
});
