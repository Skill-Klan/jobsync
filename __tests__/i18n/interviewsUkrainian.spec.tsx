// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// the Interviews screen speaks Ukrainian. Interviews → «Співбесіди», Job →
// «Вакансія»; the round (a stored job stage) and its outcome come from the
// shared `labels` dictionary; the date puts the day first, the time is 24-hour.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewsContainer from "@/components/interviews/InterviewsContainer";
import { getInterviewList } from "@/actions/interview.actions";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/interview.actions", () => ({ getInterviewList: vi.fn() }));
vi.mock("@/actions/jobStage.actions", () => ({
  setStageOutcome: vi.fn(),
  addJobStage: vi.fn(),
  updateJobStage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const stageType = {
  id: "t1",
  label: "2nd Technical Interview",
  value: "2nd technical interview",
  statusId: "st",
  sortOrder: 5,
};

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  jobId: "j1",
  stageTypeId: "t1",
  // A Wednesday far enough ahead to stay in the future.
  occurredAt: new Date(2099, 8, 23, 14, 30),
  isCurrent: true,
  outcome: null,
  notes: null,
  durationMins: 60,
  format: "Відео",
  location: null,
  createdAt: new Date(2026, 8, 1),
  updatedAt: new Date(2026, 8, 1),
  StageType: stageType,
  interviewers: [],
  prepQuestions: [],
  Job: { id: "j1", JobTitle: { label: "Тестувальник" }, Company: { id: "c1", label: "Northwind Labs" } },
  ...over,
});

const props = {
  rounds: [{ id: "t1", label: "2nd Technical Interview" }],
  companies: [{ id: "c1", label: "Northwind Labs" }],
  stageTypes: [stageType],
  jobStatuses: [],
};

const ENGLISH = /\b(Interviews|When|Job|Round|Format|Interviewers|Prep|Outcome|Actions|Expand|Scheduled|Awaiting outcome|Not scheduled|Not set|No date|None linked|Toggle menu|Technical Interview|Passed)\b/;

describe("Interviews in Ukrainian", () => {
  it("the list: heading, filters, columns, a round, its outcome and date", async () => {
    setTestLocale("uk");
    (getInterviewList as any).mockResolvedValue({ data: [row()], total: 1 });
    render(<InterviewsContainer {...props} />);

    expect(await screen.findByText("Тестувальник")).toBeInTheDocument();
    expect(screen.getByText("Співбесіди")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук співбесід…")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Фільтр за етапом" })).toHaveTextContent("Усі етапи");
    expect(screen.getByRole("combobox", { name: "Фільтр за компанією" })).toHaveTextContent("Усі компанії");
    for (const header of ["Коли", "Вакансія", "Етап", "Формат", "Інтервʼюери", "Підготовка", "Результат"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText("ср, 23 верес.")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.getByText("1 год")).toBeInTheDocument();
    expect(screen.getByText("Технічна співбесіда")).toBeInTheDocument();
    expect(screen.getByText("Заплановано")).toBeInTheDocument();
    expect(screen.getByText("Нікого")).toBeInTheDocument();
    expect(screen.getByRole("table").textContent).not.toMatch(ENGLISH);
  });

  it("derived and stored outcomes, a round with no date", async () => {
    setTestLocale("uk");
    (getInterviewList as any).mockResolvedValue({
      data: [
        row({ id: "s1", occurredAt: new Date(2020, 0, 1, 10, 0) }),
        row({ id: "s2", occurredAt: null, format: null, durationMins: 90 }),
        row({ id: "s3", outcome: "passed" }),
      ],
      total: 3,
    });
    render(<InterviewsContainer {...props} />);

    expect(await screen.findByText("Чекає на результат")).toBeInTheDocument();
    expect(screen.getByText("Не заплановано")).toBeInTheDocument();
    expect(screen.getByText("Без дати")).toBeInTheDocument();
    expect(screen.getByText("Не вказано")).toBeInTheDocument();
    expect(screen.getByText("90 хв")).toBeInTheDocument();
    expect(screen.getByText("Пройдено")).toBeInTheDocument();
  });

  it("an expanded round", async () => {
    setTestLocale("uk");
    (getInterviewList as any).mockResolvedValue({ data: [row()], total: 1 });
    render(<InterviewsContainer {...props} />);

    await userEvent.click(await screen.findByRole("button", { name: "Розгорнути «Тестувальник»" }));
    expect(screen.getByText("Інтервʼюери (0)")).toBeInTheDocument();
    expect(
      screen.getByText("Ще нікого не привʼязано — додайте інтервʼюерів на вкладці «Етапи» вакансії."),
    ).toBeInTheDocument();
    expect(screen.getByText("Питання для підготовки (0)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Згорнути «Тестувальник»" })).toBeInTheDocument();
  });

  it("the row menu offers the outcomes in Ukrainian", async () => {
    setTestLocale("uk");
    (getInterviewList as any).mockResolvedValue({ data: [row()], total: 1 });
    render(<InterviewsContainer {...props} />);

    await userEvent.click(await screen.findByRole("button", { name: "Відкрити меню" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Дії")).toBeInTheDocument();
    expect(within(menu).getByText("Указати результат")).toBeInTheDocument();
    expect(within(menu).getByText("Редагувати етап")).toBeInTheDocument();
    expect(within(menu).getByText("Відкрити хронологію вакансії")).toBeInTheDocument();
  });

  it("no interviews yet", async () => {
    setTestLocale("uk");
    (getInterviewList as any).mockResolvedValue({ data: [], total: 0 });
    render(<InterviewsContainer {...props} />);

    expect(
      await screen.findByText(
        "Співбесід ще немає. Додайте етап співбесіди на вкладці «Етапи» вакансії — і він зʼявиться тут.",
      ),
    ).toBeInTheDocument();
  });
});
