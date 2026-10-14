// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary:
// Automation → «автопошук», one run → «запуск», job → «вакансія», buttons are
// verbs): the Automations area speaks Ukrainian — the list, the create wizard,
// an automation's page (header, summary, logs, discovered jobs, run history)
// and the messages its server actions return. Stored statuses come from the
// `labels` dictionary; dates are day-first with 24-hour time.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutomationContainer } from "@/components/automations/AutomationContainer";
import { AutomationDetailHeader } from "@/components/automations/automation-detail-container/AutomationDetailHeader";
import { AutomationSummaryCard } from "@/components/automations/automation-detail-container/AutomationSummaryCard";
import { LogsTab } from "@/components/automations/LogsTab";
import { RunHistoryList } from "@/components/automations/RunHistoryList";
import { DiscoveredJobsList } from "@/components/automations/DiscoveredJobsList";
import { getAutomationsList } from "@/actions/automation.actions";
import { getAutomationById } from "@/actions/automation/queries";
import { createAutomation } from "@/actions/automation/mutations";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import type { AutomationRun, AutomationWithResume, DiscoveredJob } from "@/models/automation.model";
import { setTestLocale } from "../helpers/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/dashboard/automations",
}));

// The components import the barrel; the real server actions are imported from
// their own modules below and run against a mocked Prisma client.
vi.mock("@/actions/automation.actions", () => ({
  getAutomationsList: vi.fn(),
  createAutomation: vi.fn(),
  updateAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  pauseAutomation: vi.fn(),
  resumeAutomation: vi.fn(),
  deleteAutomationRun: vi.fn(),
  acceptDiscoveredJob: vi.fn(),
  dismissDiscoveredJob: vi.fn(),
  analyzeDiscoveredJob: vi.fn(),
  clearDiscoveredJobs: vi.fn(),
}));

// The wizard keeps every step mounted, so the company search step's actions
// load too (same mocks as __tests__/AtsSearchStep.spec.tsx).
vi.mock("@/actions/atsCompany.actions", () => ({
  searchAtsCompanies: vi.fn().mockResolvedValue({ companies: [], hasMore: false }),
  getAtsCompanyCount: vi.fn().mockResolvedValue(0),
  resolveAtsBoard: vi.fn(),
}));
vi.mock("@/actions/company.actions", () => ({ getWatchedBoards: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/jobtitle.actions", () => ({ getAllJobTitles: vi.fn().mockResolvedValue([]), createJobTitle: vi.fn() }));
vi.mock("@/actions/tag.actions", () => ({ getAllTags: vi.fn().mockResolvedValue([]), createTag: vi.fn() }));
vi.mock("@/actions/jobLocation.actions", () => ({ getAllJobLocations: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/job.actions", () => ({ createLocation: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toastInfo: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@prisma/client", () => {
  const client = {
    automation: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    resume: { findFirst: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));

const prisma = new PrismaClient();

// English words these screens showed before translation. Brand names
// (Greenhouse), numbers and the shared "Showing 1 to N" counter are not ours.
const ENGLISH =
  /\b(Automations?|Create|Edit|Delete|Pause|Resume|Run Now|daily|threshold|Next|Last|Titles|Keywords|Location|Any|Status|Started|Duration|Searched|Processed|Matched|Saved|Error|Logs|All|Info|Success|Warning|No [a-z]+ (yet|found)|Discovered|Company|Actions|Never|Missing|total|completed|active|Fetched|Relevant|Show (more|less))\b/;

const automation = {
  id: "a1",
  userId: "u1",
  name: "Frontend у Києві",
  jobBoard: "greenhouse",
  keywords: "",
  location: "",
  sourceConfig: JSON.stringify({
    greenhouse: { companies: [{ name: "Acme", token: "acme" }], targetTitles: [], keywords: [], locations: [] },
  }),
  resumeId: "r1",
  resume: { id: "r1", title: "Моє резюме" },
  matchThreshold: 80,
  scheduleHour: 8,
  status: "active",
  nextRunAt: new Date(2026, 9, 15, 8, 0),
  lastRunAt: new Date(2026, 9, 14, 8, 0),
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
} as unknown as AutomationWithResume;

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe("automations list and the create wizard in Ukrainian", () => {
  beforeEach(() => {
    vi.mocked(getAutomationsList).mockResolvedValue({ success: true, data: [automation], total: 1 });
  });

  it("the list: heading, create button, status, schedule and dates in Ukrainian", async () => {
    setTestLocale("uk");
    const { container } = render(<AutomationContainer resumes={[]} />);
    await screen.findByText("Frontend у Києві");

    expect(screen.getByText("Автопошук")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити автопошук" })).toBeInTheDocument();
    expect(screen.getByText("активний")).toBeInTheDocument();
    const text = container.textContent!.replace(/\s+/g, " ");
    expect(text).toContain("щодня о 08:00");
    expect(text).toContain("поріг 80%");
    expect(text).toContain("Наступний: 15 жовт., 08:00");
    expect(text).toContain("Останній: 14 жовт., 08:00");
    expect(text).toContain("Будь-яка локація");
    expect(text).not.toMatch(ENGLISH);
  });

  it("the list when empty", async () => {
    setTestLocale("uk");
    vi.mocked(getAutomationsList).mockResolvedValue({ success: true, data: [], total: 0 });
    render(<AutomationContainer resumes={[]} />);
    expect(await screen.findByText("Автопошуків ще немає")).toBeInTheDocument();
  });

  it("the wizard opens on its first step in Ukrainian", async () => {
    setTestLocale("uk");
    render(<AutomationContainer resumes={[]} />);
    await screen.findByText("Frontend у Києві");
    await userEvent.click(screen.getByRole("button", { name: "Створити автопошук" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Створити автопошук" })).toBeInTheDocument();
    expect(within(dialog).getByText("Крок 1 з 6: Назвіть автопошук")).toBeInTheDocument();
    expect(within(dialog).getByText("Назва автопошуку")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Далі" })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/\b(Step|Next|Back|Automation Name|Job Board|company boards)\b/);
  });
});

describe("an automation's page in Ukrainian", () => {
  it("header buttons are verbs from the glossary", () => {
    setTestLocale("uk");
    const noop = () => {};
    const { container } = render(
      <AutomationDetailHeader
        automation={automation}
        retired={false}
        resumeMissing={false}
        runActive={false}
        aborting={false}
        actionLoading={false}
        jobsBusy={false}
        onRefresh={noop}
        onEdit={noop}
        onDelete={noop}
        onPauseResume={noop}
        onAbort={noop}
        onRunNow={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Редагувати" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Призупинити" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустити зараз" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("the summary card: labels, status, schedule and run dates", () => {
    setTestLocale("uk");
    const { container } = render(
      <AutomationSummaryCard
        automation={automation}
        retired={false}
        resumeMissing={false}
        isRunning
        totalJobs={12}
        newJobsCount={3}
      />,
    );
    const text = container.textContent!.replace(/\s+/g, " ");
    expect(text).toContain("Статус");
    expect(text).toContain("активний");
    expect(text).toContain("Триває");
    expect(text).toContain("Поріг відповідності");
    expect(text).toContain("щодня о 08:00");
    expect(text).toContain("Наступний запуск15 жовт., 08:00");
    expect(text).toContain("Останній запуск14 жовт., 08:00");
    expect(text).toContain("Усього: 12");
    expect(text).toContain("Нових: 3");
    expect(text).not.toMatch(ENGLISH);
  });

  it("logs: filters and the empty state", () => {
    setTestLocale("uk");
    const { container } = render(
      <LogsTab logData={{ logs: [], isRunning: false, startedAt: new Date(2026, 9, 14, 8, 0, 5).toISOString() }} onClearLogs={() => {}} />,
    );
    expect(screen.getByText("Журнал автопошуку")).toBeInTheDocument();
    for (const name of ["Усі", "Інфо", "Успіх", "Попередження", "Помилка"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Журнал поки порожній. Запустіть автопошук, щоб побачити записи.")).toBeInTheDocument();
    expect(container.textContent).toContain("Початок: 14 жовт., 08:00:05");
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("run history: headers, run status, funnel and date", () => {
    setTestLocale("uk");
    const run: AutomationRun = {
      id: "run-1",
      automationId: "a1",
      jobsSearched: 10,
      jobsDeduplicated: 8,
      jobsProcessed: 8,
      jobsMatched: 3,
      jobsSaved: 2,
      status: "completed",
      errorMessage: null,
      blockedReason: null,
      funnelStats: JSON.stringify([
        { key: "fetched", label: "Fetched", count: 10 },
        { key: "floor", label: "Relevant", count: 4 },
      ]),
      startedAt: new Date(2024, 5, 1, 10, 0),
      completedAt: new Date(2024, 5, 1, 10, 5),
    };
    const { container } = render(
      <RunHistoryList runs={[run]} totalRuns={1} loadingMore={false} onLoadMore={() => {}} />,
    );
    expect(screen.getByText("Історія запусків")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "Статус", "Початок", "Тривалість", "Отримано", "Нові", "Оброблено", "Відповідають", "Збережено", "Помилка", "",
    ]);
    expect(screen.getByText("завершено")).toBeInTheDocument();
    expect(screen.getByText("1 черв., 10:00")).toBeInTheDocument();
    expect(screen.getByText("300 с")).toBeInTheDocument();
    expect(container.textContent).toContain("Отримано");
    expect(container.textContent).toContain("Доречні");
    expect(container.textContent).toContain("запусків");
    expect(container.textContent!.replace("Showing", "")).not.toMatch(ENGLISH);
  });

  it("run history when empty", () => {
    setTestLocale("uk");
    render(<RunHistoryList runs={[]} totalRuns={0} loadingMore={false} onLoadMore={() => {}} />);
    expect(screen.getByText("Запусків ще не було")).toBeInTheDocument();
  });

  it("discovered jobs: headers, stored status via labels, date", () => {
    setTestLocale("uk");
    const job = {
      id: "job-1",
      userId: "u1",
      automationId: "a1",
      jobUrl: null,
      description: "desc",
      jobType: "full-time",
      createdAt: new Date(2024, 5, 1),
      jobTitleId: "t1",
      companyId: "c1",
      locationId: "l1",
      matchScore: 80,
      matchData: null,
      discoveryStatus: "new",
      discoveredAt: new Date(2024, 5, 1),
      JobTitle: { label: "Software Engineer" },
      Company: { label: "Acme Corp" },
      Location: { label: "Remote" },
    } as DiscoveredJob;
    const { container } = render(
      <DiscoveredJobsList
        jobs={[job]}
        totalJobs={1}
        loadingMore={false}
        onLoadMore={() => {}}
        dismissedCount={0}
        newCount={1}
        acceptedCount={0}
        statusFilter={["new", "accepted"]}
        onStatusFilterChange={() => {}}
        automationId="a1"
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText("Знайдені вакансії")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Вакансія", "Компанія", "Локація", "Збіг слів", "Відповідність", "Статус", "Знайдено", "Дії"]);
    expect(screen.getByText("Нова")).toBeInTheDocument();
    expect(screen.getByText("1 черв. 2024")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Очистити" })).toBeInTheDocument();
    expect(container.textContent!.replace("Showing", "").replace("Software Engineer", "").replace("Acme Corp", "")).not.toMatch(ENGLISH);
  });

  it("discovered jobs when there are none", () => {
    setTestLocale("uk");
    render(
      <DiscoveredJobsList
        jobs={[]}
        totalJobs={0}
        loadingMore={false}
        onLoadMore={() => {}}
        dismissedCount={0}
        newCount={0}
        acceptedCount={0}
        statusFilter={["new"]}
        onStatusFilterChange={() => {}}
        automationId="a1"
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText("Знайдених вакансій немає")).toBeInTheDocument();
  });
});

describe("server actions answer in Ukrainian", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1" } as never);
  });

  it("an automation that is not there", async () => {
    setTestLocale("uk");
    vi.mocked(prisma.automation.findFirst).mockResolvedValue(null);
    await expect(getAutomationById("missing")).resolves.toEqual({ success: false, message: "Автопошук не знайдено" });
  });

  it("an hour already taken by another automation", async () => {
    setTestLocale("uk");
    vi.mocked(prisma.automation.count).mockResolvedValue(1);
    vi.mocked(prisma.automation.findFirst).mockResolvedValue({ id: "other" } as never);
    const result = await createAutomation({
      name: "Тест",
      jobBoard: "greenhouse",
      keywords: "",
      location: "",
      sourceConfig: { greenhouse: { companies: [{ name: "Acme", token: "acme" }] } },
      resumeId: "11111111-1111-4111-8111-111111111111",
      matchThreshold: 80,
      scheduleHour: 8,
    } as never);
    expect(result).toEqual({ success: false, message: "Інший автопошук уже запускається о 08:00. Виберіть інший час." });
  });

  it("in English the same message stays as it was", async () => {
    vi.mocked(prisma.automation.findFirst).mockResolvedValue(null);
    await expect(getAutomationById("missing")).resolves.toEqual({ success: false, message: "Automation not found" });
  });
});
