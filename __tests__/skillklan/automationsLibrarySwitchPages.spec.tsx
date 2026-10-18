// Requirement — the owner, 2026-10-18. Server side of two more switches, "on
// the same principle" as Activities (D73) — the admin sees what everyone sees:
//   · Automations off: the Automations list and an automation's page are not
//     there (404); D75 the Notifications page neither, and the bell is gone
//     from the header; the phone menu has no Automations;
//   · the Library off: the Library page and D76 a company's page are not there
//     (404); the phone menu has no Library.
// A closed page reads none of its data. Each "off" has its "on" pair.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const flags = vi.hoisted(() => ({
  value: { automations: true, activities: true, library: true },
}));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: vi.fn(() => "/dashboard"),
}));

// Pages under test render these; here they only show they were reached.
vi.mock("@/actions/profile.actions", () => ({ getResumeList: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/components/automations/AutomationContainer", () => ({
  AutomationContainer: () => <div data-testid="automations" />,
}));
vi.mock("@/components/automations/AutomationDetailContainer", () => ({
  AutomationDetailContainer: () => <div data-testid="automation" />,
}));
vi.mock("@/components/admin/AdminTabsContainer", () => ({ default: () => <div data-testid="library" /> }));
vi.mock("@/actions/company.actions", () => ({ getCompanyDetails: vi.fn(async () => ({ id: "c-1" })) }));
vi.mock("@/components/admin/CompanyDetails", () => ({ default: () => <div data-testid="company" /> }));
vi.mock("@/actions/notification.actions", () => ({
  getNotificationList: vi.fn(async () => ({ success: true, data: { items: [], total: 0, counts: {} } })),
  getNotificationFilterOptions: vi.fn(async () => ({ success: true, data: [] })),
}));
vi.mock("@/components/notifications/NotificationsContainer", () => ({
  NotificationsContainer: () => <div data-testid="notifications" />,
}));
vi.mock("@/components/notifications/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="bell" />,
}));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));

import AutomationsPage from "@/app/dashboard/automations/page";
import AutomationPage from "@/app/dashboard/automations/[id]/page";
import NotificationsPage from "@/app/dashboard/notifications/page";
import LibraryPage from "@/app/dashboard/admin/page";
import CompanyPage from "@/app/dashboard/admin/companies/[id]/page";
import Header from "@/components/Header";
import { getResumeList } from "@/actions/profile.actions";
import { getCompanyDetails } from "@/actions/company.actions";
import { getNotificationList, getNotificationFilterOptions } from "@/actions/notification.actions";

const params = { params: Promise.resolve({ id: "x-1" }) };

const pages = [
  ["automations", "the Automations list", () => AutomationsPage(), "automations", () => [getResumeList]],
  ["automations", "an automation's page", () => AutomationPage(params), "automation", () => []],
  [
    "automations",
    "the Notifications page",
    () => NotificationsPage(),
    "notifications",
    () => [getNotificationList, getNotificationFilterOptions],
  ],
  ["library", "the Library page", () => LibraryPage(), "library", () => []],
  ["library", "a company's page", () => CompanyPage(params), "company", () => [getCompanyDetails]],
] as const;

beforeEach(() => {
  flags.value = { automations: true, activities: true, library: true };
});

describe.each(pages)("%s switch — %s", (key, _label, page, testId, reads) => {
  it("off → not there (404), and its data is not read", async () => {
    flags.value = { ...flags.value, [key]: false };
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    for (const read of reads()) expect(read).not.toHaveBeenCalled();
  });

  it("on → the page as before", async () => {
    // The other switch off: it must not close this page.
    flags.value = { ...flags.value, [key === "automations" ? "library" : "automations"]: false };
    render(await page());
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});

describe("the header", () => {
  it.each([
    [false, false],
    [true, true],
  ])("Automations %s → the notification bell shown: %s", async (automations, shown) => {
    flags.value = { ...flags.value, automations };
    render(await Header());
    if (shown) expect(screen.getByTestId("bell")).toBeInTheDocument();
    else expect(screen.queryByTestId("bell")).not.toBeInTheDocument();
  });

  it.each([
    ["automations", "Automations"],
    ["library", "Library"],
  ] as const)("phone menu: %s off → no %s link, the rest stay", async (key, name) => {
    const user = userEvent.setup();
    flags.value = { ...flags.value, [key]: false };
    render(await Header());
    await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
    expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });
});
