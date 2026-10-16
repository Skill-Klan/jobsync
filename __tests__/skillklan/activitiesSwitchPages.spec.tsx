// Requirement — the owner, 2026-10-16. Server side of the feature switches:
//   · Settings → «Функції» is there only for an admin; everyone else gets no
//     section and no switch values;
//   · Activities off: the Activities page is not there (404) — for the admin
//     too; the phone menu has no Activities; the layout shows no running-
//     activity banner; the dashboard shows applications only and does not
//     even read activity data.
// Each "off" has its "on" pair.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const flags = vi.hoisted(() => ({ value: { activities: false }, admin: { value: false } }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => flags.admin.value) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: vi.fn(() => "/dashboard"),
}));

// Pages under test render these; here they only report what they were given.
vi.mock("@/components/settings/SettingsView", () => ({
  default: (props: { features: unknown }) => (
    <div data-testid="settings-view" data-features={JSON.stringify(props.features)} />
  ),
}));
vi.mock("@/components/activities/ActivitiesContainer", () => ({
  default: () => <div data-testid="activities-container" />,
}));
vi.mock("@/components/dashboard/JobsActivityCard", () => ({ default: () => <div data-testid="jobs-activity-card" /> }));
vi.mock("@/components/dashboard/ActivityCalendar", () => ({ default: () => <div data-testid="activity-calendar" /> }));
vi.mock("@/components/dashboard/JobsAppliedCard", () => ({ default: () => <div data-testid="quick-actions" /> }));
vi.mock("@/components/dashboard/DailyGoalsCalendar", () => ({ default: () => <div data-testid="goals" /> }));
vi.mock("@/components/dashboard/WeeklyBarChartToggle", () => ({
  default: (props: { charts: { id: string }[] }) => (
    <div data-testid="weekly" data-charts={props.charts.map((c) => c.id).join(",")} />
  ),
}));
vi.mock("@/components/dashboard/RecentCardToggle", () => ({
  default: (props: { activities: unknown[] }) => (
    <div data-testid="recent" data-activities={props.activities.length} />
  ),
}));
vi.mock("@/actions/dashboard.actions", () => ({
  getJobsActivitySummary: vi.fn(async () => ({ jobsApplied: 0 })),
  getRecentJobs: vi.fn(async () => []),
  getRecentActivities: vi.fn(async () => [{ id: "a1" }]),
  getJobsActivityForPeriod: vi.fn(async () => []),
  getActivityDataForPeriod: vi.fn(async () => ({ data: [], keys: [] })),
  getActivityCalendarData: vi.fn(async () => ({ "2026": [] })),
}));
vi.mock("@/actions/dailyGoals.actions", () => ({
  getDailyGoalValues: vi.fn(async () => ({ success: true, data: { values: {}, targets: {} } })),
  getGoalStreaks: vi.fn(async () => ({ success: true, data: { current: 0, best: 0 } })),
}));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import SettingsPage from "@/app/dashboard/settings/page";
import ActivitiesPage from "@/app/dashboard/activities/page";
import Dashboard from "@/app/dashboard/page";
import Header from "@/components/Header";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import * as dashboardActions from "@/actions/dashboard.actions";

beforeEach(() => {
  flags.value = { activities: false };
  flags.admin.value = false;
});

describe("Settings page — «Функції» for admins only", () => {
  it("not an admin → no switches at all, and they are not even read", async () => {
    render(await SettingsPage());
    expect(screen.getByTestId("settings-view")).toHaveAttribute("data-features", "null");
    expect(getFeatureFlags).not.toHaveBeenCalled();
  });

  it("an admin → the switches as they are now", async () => {
    flags.admin.value = true;
    render(await SettingsPage());
    expect(screen.getByTestId("settings-view")).toHaveAttribute("data-features", '{"activities":false}');
  });
});

describe("the Activities page", () => {
  it("off → not there (404), whoever asks", async () => {
    flags.admin.value = true;
    await expect(ActivitiesPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("on → the page as before", async () => {
    flags.value = { activities: true };
    render(await ActivitiesPage());
    expect(screen.getByTestId("activities-container")).toBeInTheDocument();
  });
});

describe("the dashboard", () => {
  const activityReads = () => [
    dashboardActions.getJobsActivitySummary,
    dashboardActions.getRecentActivities,
    dashboardActions.getActivityDataForPeriod,
    dashboardActions.getActivityCalendarData,
  ];

  it("off → applications only: no hours card, no activity calendar, one weekly chart, no recent activities; activity data not read", async () => {
    render(await Dashboard());
    expect(screen.queryByTestId("jobs-activity-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("activity-calendar")).not.toBeInTheDocument();
    expect(screen.getByTestId("weekly")).toHaveAttribute("data-charts", "Jobs");
    expect(screen.getByTestId("recent")).toHaveAttribute("data-activities", "0");
    for (const read of activityReads()) expect(read).not.toHaveBeenCalled();
    expect(dashboardActions.getRecentJobs).toHaveBeenCalled();
  });

  it("on → everything as before", async () => {
    flags.value = { activities: true };
    render(await Dashboard());
    expect(screen.getByTestId("jobs-activity-card")).toBeInTheDocument();
    expect(screen.getByTestId("activity-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("weekly")).toHaveAttribute("data-charts", "Jobs,Activities");
    expect(screen.getByTestId("recent")).toHaveAttribute("data-activities", "1");
    for (const read of activityReads()) expect(read).toHaveBeenCalled();
  });
});

describe("the phone menu (Header)", () => {
  it.each([
    [false, false],
    [true, true],
  ])("Activities %s → the Activities link shown: %s", async (activities, shown) => {
    flags.value = { activities };
    const user = userEvent.setup();
    render(await Header());
    await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
    const link = screen.queryByRole("link", { name: "Activities" });
    if (shown) expect(link).toBeInTheDocument();
    else expect(link).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });
});
