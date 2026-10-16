// Requirement — the owner, 2026-10-16: the Activities tab "can go, but I would
// not delete it — hide it behind a feature switch". With Activities switched
// off in Settings → «Функції»:
//   · neither menu (the sidebar, the phone menu) has «Активності»;
//   · the dashboard is about applications alone — no "Add activity", no
//     recent activities, no hours goal; "the orange activity circle must go
//     too" (the hours ring, --gc-ring-2);
//   · the goals dialog asks only for applications and keeps the hours target
//     as it was.
// Each case has a pair with Activities on, so "gone" is not just "never there".
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import DailyGoalsCalendar from "@/components/dashboard/DailyGoalsCalendar";
import { SidebarProvider } from "@/context/SidebarContext";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { useActivity } from "@/context/ActivityContext";
import { useNotifications } from "@/context/NotificationContext";
import { updateGoalTargets } from "@/actions/dailyGoals.actions";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dashboard"),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));
vi.mock("@/context/NotificationContext", () => ({ useNotifications: vi.fn() }));
vi.mock("@/context/ActivityContext", () => ({ useActivity: vi.fn() }));
vi.mock("@/actions/dailyGoals.actions", () => ({
  getDailyGoalValues: vi.fn(),
  updateGoalTargets: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn((result, opts) => {
    if (result?.success) opts.onSuccess?.(result.data);
  }),
}));

beforeEach(() => {
  localStorage.clear();
  (useNotifications as any).mockReturnValue({ summary: { unread: 0, unreadErrors: 0 }, refresh: vi.fn() });
  (useActivity as any).mockReturnValue({ currentActivity: undefined, startActivity: vi.fn() });
});

const withFeatures = (activities: boolean, ui: React.ReactNode) =>
  render(<FeaturesProvider value={{ activities }}>{ui}</FeaturesProvider>);

describe.each([
  [false, "off"],
  [true, "on (pair)"],
])("Activities %s", (activities, _label) => {
  const expectPresence = (el: HTMLElement | null) =>
    activities ? expect(el).toBeInTheDocument() : expect(el).not.toBeInTheDocument();

  it("sidebar: the Activities link follows the switch, the rest stay", () => {
    withFeatures(
      activities,
      <SidebarProvider initialExpanded>
        <Sidebar user={{ id: "1", name: "A", email: "a@example.invalid" }} signOutAction={() => {}} />
      </SidebarProvider>,
    );
    expectPresence(screen.queryByRole("link", { name: "Activities" }));
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });

  it("dashboard quick actions: Add Activity and the word in the description follow the switch", () => {
    const { container } = withFeatures(activities, <JobsAppliedCard />);
    expectPresence(screen.queryByRole("button", { name: "Add Activity" }));
    expect(screen.getByRole("button", { name: "Add Task" })).toBeInTheDocument();
    if (activities) expect(container.textContent).toMatch(/activities/i);
    else expect(container.textContent).not.toMatch(/activit/i);
  });

  it("recent card: the Activities tab follows the switch", () => {
    // A remembered "Activities" tab must not bring it back.
    localStorage.setItem("dashboard-recent-card-tab", JSON.stringify("Activities"));
    withFeatures(activities, <RecentCardToggle jobs={[]} activities={[]} />);
    expectPresence(screen.queryByRole("button", { name: "Activities" }));
    // On, the remembered tab is restored — proof the memory works; off, it
    // finds no tab and the card opens on jobs.
    expect(screen.getByText(activities ? "Recent Activities" : "Recent Jobs")).toBeInTheDocument();
  });

  const renderGoals = () =>
    withFeatures(
      activities,
      <DailyGoalsCalendar
        today="2026-10-05"
        initialData={{ values: { "2026-10-01": { jobs: 3, hours: 2.5 } }, targets: {} }}
        initialStreaks={{ current: 2, best: 11 }}
      />,
    );

  it("goals: the orange hours ring (--gc-ring-2) and its legend follow the switch", () => {
    renderGoals();
    const orange = document.querySelectorAll('[class*="gc-ring-2"]');
    if (activities) expect(orange.length).toBeGreaterThan(0);
    else expect(orange).toHaveLength(0);
    const calendar = within(Array.from(document.querySelectorAll<HTMLElement>(".daily-goals-calendar")).at(-1)!);
    expectPresence(calendar.queryByText("Activity"));
    expect(calendar.getByText("Jobs applied")).toBeInTheDocument();
  });

  it("goals: one goal tracked — 'Goal hit', not 'Both goals met'", () => {
    renderGoals();
    const summary = within(document.querySelectorAll<HTMLElement>(".daily-goals-calendar")[0]);
    const terms = summary.getAllByRole("term").map((el) => el.textContent);
    expect(terms).toContain(activities ? "Both goals met" : "Goal hit");
  });

  it("goals dialog: the hours goal follows the switch; switched off, its target is saved back unchanged", async () => {
    (updateGoalTargets as any).mockResolvedValue({ success: true, data: { targets: {}, streaks: null } });
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole("button", { name: "Set goals" }));
    expectPresence(screen.queryByLabelText("Activity hours per day"));
    await user.click(screen.getByRole("button", { name: "More jobs" }));
    await user.click(screen.getByRole("button", { name: "Save goals" }));
    // Defaults: 5 jobs, 4 hours — one more job, hours as they were.
    expect(updateGoalTargets).toHaveBeenCalledWith(expect.objectContaining({ jobs: 6, hours: 4 }));
  });
});
