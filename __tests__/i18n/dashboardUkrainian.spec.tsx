// Requirement — D29/D30: the dashboard speaks Ukrainian — headings, buttons,
// empty states, counts with Ukrainian plurals, dates day-first with Ukrainian
// months, stored job statuses by the glossary — and no English is left.
import { render, screen, within } from "@testing-library/react";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import JobsActivityCard from "@/components/dashboard/JobsActivityCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import SetGoalsDialog from "@/components/dashboard/SetGoalsDialog";
import DailyGoalsCalendar from "@/components/dashboard/DailyGoalsCalendar";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";
import { setTestLocale } from "../helpers/i18n";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/hooks/useElementWidth", () => ({ useElementWidth: () => [{ current: null }, 400] as const }));
vi.mock("@/context/ActivityContext", () => ({ useActivity: () => ({ startActivity: vi.fn(), currentActivity: null }) }));
vi.mock("@/actions/dailyGoals.actions", () => ({ updateGoalTargets: vi.fn(), getDailyGoalValues: vi.fn() }));
vi.mock("@/actions/company.actions", () => ({ getAllCompanies: vi.fn(async () => []) }));
vi.mock("@/actions/jobLocation.actions", () => ({ getAllJobLocations: vi.fn(async () => []) }));
vi.mock("@/actions/contactRole.actions", () => ({ getAllContactRoles: vi.fn(async () => []) }));
vi.mock("@nivo/pie", () => ({
  Pie: (props: any) => (
    <div data-testid="donut">
      {props.data.map((s: any) => <div key={s.id}>{s.label}</div>)}
    </div>
  ),
}));
vi.mock("@nivo/calendar", () => ({
  ResponsiveCalendar: (props: any) => (
    <div>
      {props.data.map((d: any) => <div key={d.day} data-testid={`day-${d.day}`}>{props.tooltip(d)}</div>)}
      <div data-testid="month-legend">{props.monthLegend?.(2026, 9, new Date(2026, 9, 1))}</div>
    </div>
  ),
}));
vi.mock("@nivo/bar", () => ({ ResponsiveBar: () => <div data-testid="bar" /> }));

const ENGLISH = /\b(Add|Save|Cancel|Recent|Weekly|Dashboard|Activity|Activities|Jobs?|Select|Other|streak|Goal|goals|day|days|hrs?|applied|No date|In progress|Unknown)\b/;

beforeEach(() => {
  localStorage.clear();
  setTestLocale("uk");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
});

describe("dashboard in Ukrainian", () => {
  it("quick actions", () => {
    const { container } = render(<JobsAppliedCard />);
    expect(screen.getByText("Головна")).toBeInTheDocument();
    for (const name of ["Додати вакансію", "Додати автопошук", "Додати завдання", "Додати питання", "Додати активність", "Додати контакт"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("jobs & activity card: Ukrainian plural, hours, the Other slice", () => {
    const summary = {
      jobsApplied: 16, jobsTrend: 0, totalHours: 30,
      topActivities: [{ label: "Навчання", hours: 20 }],
      otherActivities: [{ label: "Нетворкінг", hours: 10 }], otherHours: 10,
    };
    const { container } = render(<JobsActivityCard data={[{ id: "7d", label: "7 дн.", summary }]} />);
    expect(screen.getByText("Вакансії й активності")).toBeInTheDocument();
    expect(screen.getByText("16 вакансій")).toBeInTheDocument();
    expect(screen.getByText("30 год")).toBeInTheDocument();
    expect(screen.getByText("Інше")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("the tab chosen in English stays chosen in Ukrainian (remembered by id, not by label)", () => {
    localStorage.setItem("dashboard-jobs-activity-tab", JSON.stringify("30d"));
    const s = (jobs: number) => ({ jobsApplied: jobs, jobsTrend: 0, totalHours: 0, topActivities: [], otherActivities: [], otherHours: 0 });
    render(
      <JobsActivityCard data={[{ id: "7d", label: "7 дн.", summary: s(1) }, { id: "30d", label: "30 дн.", summary: s(5) }]} />,
    );
    expect(screen.getByText("5 вакансій")).toBeInTheDocument();
  });

  it("jobs & activity card: empty state", () => {
    const empty = { jobsApplied: 1, jobsTrend: 0, totalHours: 0, topActivities: [], otherActivities: [], otherHours: 0 };
    render(<JobsActivityCard data={[{ id: "7d", label: "7 дн.", summary: empty }]} />);
    expect(screen.getByText("Активностей ще немає")).toBeInTheDocument();
    expect(screen.getByText("1 вакансія")).toBeInTheDocument();
  });

  it("recent jobs: Ukrainian date header and the stored status by the glossary", () => {
    const jobs = [{
      id: "j1", appliedDate: new Date(2026, 9, 14, 12), JobTitle: { label: "QA Engineer" }, Company: { label: "Acme" },
      Status: { label: "Applied", value: "applied" },
    }] as any;
    const { container } = render(<RecentCardToggle jobs={jobs} activities={[]} />);
    expect(screen.getByText("Нещодавні вакансії")).toBeInTheDocument();
    expect(screen.getByText("ср, 14 жовтня 2026")).toBeInTheDocument();
    expect(screen.getByText("Відгук надіслано")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("recent activities: duration in hours and minutes", async () => {
    const activities = [{ id: "a1", activityName: "Резюме", duration: 90, endTime: new Date(2026, 9, 14, 10), activityType: null }];
    render(<RecentCardToggle jobs={[]} activities={activities} />);
    screen.getByRole("button", { name: "Активності" }).click();
    expect(await screen.findByText("Нещодавні активності")).toBeInTheDocument();
    expect(screen.getByText("1 год 30 хв")).toBeInTheDocument();
    expect(screen.getByText("Без типу")).toBeInTheDocument();
  });

  it("activity calendar: tooltip and months in Ukrainian", () => {
    const { container } = render(
      <ActivityCalendar years={["2026"]} dataByYear={{ "2026": [{ day: "2026-06-15", value: 2, hours: 2.5 }] }} />,
    );
    expect(screen.getByText("Календар активностей")).toBeInTheDocument();
    const day = within(screen.getByTestId("day-2026-06-15"));
    expect(day.getByText("пн, 15 черв. 2026")).toBeInTheDocument();
    expect(day.getByText("2 відгуки надіслано")).toBeInTheDocument();
    expect(day.getByText("2,5 години активності")).toBeInTheDocument();
    expect(screen.getByTestId("month-legend")).toHaveTextContent("жовт.");
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("weekly chart: Ukrainian title", () => {
    render(
      <WeeklyBarChartToggle
        charts={[{ id: "Activities", label: "Активності", title: "Активності за тиждень", data: [], keys: [], groupMode: "stacked", axisLeftLegend: "ЧАС (ГОДИНИ)" }]}
      />,
    );
    expect(screen.getByText("Активності за тиждень")).toBeInTheDocument();
    expect(screen.getByText("0.0 год".replace(".", ","))).toBeInTheDocument();
  });

  it("goals dialog: month in the right case, fields and buttons", () => {
    const { baseElement } = render(
      <SetGoalsDialog open onOpenChange={vi.fn()} month="2026-10" targets={{ jobs: 5, hours: 4 }} onSaved={vi.fn()} />,
    );
    expect(screen.getByText("Цілі на день")).toBeInTheDocument();
    expect(screen.getByText("жовтень 2026")).toBeInTheDocument();
    expect(screen.getByText(/Діє з жовтня 2026/)).toBeInTheDocument();
    expect(screen.getByLabelText("Відгуків на день")).toBeInTheDocument();
    expect(screen.getByLabelText("Годин активності на день")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Менше відгуків" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Зберегти цілі" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(within(baseElement.querySelector('[role="dialog"]') as HTMLElement).queryByText(ENGLISH)).toBeNull();
  });

  it("goals calendar: streaks with Ukrainian plurals, Ukrainian month and controls", () => {
    render(
      <DailyGoalsCalendar
        today="2026-10-05"
        initialData={{ values: { "2026-10-01": { jobs: 3, hours: 2.5 } }, targets: {} }}
        initialStreaks={{ current: 2, best: 11 }}
      />,
    );
    expect(screen.getByText("Поточна серія")).toBeInTheDocument();
    expect(screen.getByText("2 дні")).toBeInTheDocument();
    expect(screen.getByText("Найкраща серія (12 міс.)")).toBeInTheDocument();
    expect(screen.getByText("11 днів")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Налаштувати цілі" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Попередній місяць" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/жовтень/i).length).toBeGreaterThan(0);
  });
});
