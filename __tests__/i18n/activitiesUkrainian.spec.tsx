// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// the Activities screen, the break timer, the running-activity banner and the
// messages the activity actions return speak Ukrainian. Activities →
// «Активності»; dates put the day first and use 24-hour time; counts agree with
// the number (1 активність, 3 активності, 5 активностей).
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivitiesContainer from "@/components/activities/ActivitiesContainer";
import { BreakModal } from "@/components/activities/BreakModal";
import { ActivityBanner } from "@/components/activities/ActivityBanner";
import { getActivitiesList, getAllActivityTypes } from "@/actions/activity.actions";
import { deleteActivityTypeById as deleteActivityTypeByIdReal } from "@/actions/activity/activityTypes";
import { updateBreakLength as updateBreakLengthReal } from "@/actions/activity/breaks";
import { useActivity } from "@/context/ActivityContext";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/activity.actions", () => ({
  getActivitiesList: vi.fn(),
  getAllActivityTypes: vi.fn(),
  createActivity: vi.fn(),
  deleteActivityById: vi.fn(),
}));
// SkillKlan feature switches: Activities on — these tests are about the
// actions themselves; switched off is __tests__/skillklan/activitiesSwitchActions.spec.ts.
vi.mock("@/skillklan/featureFlags", () => ({ isFeatureOff: vi.fn(async () => false) }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@prisma/client", () => {
  const client = {
    activity: { count: vi.fn(), findFirst: vi.fn() },
    task: { count: vi.fn() },
    activityType: { delete: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock("@/context/ActivityContext", () => ({ useActivity: vi.fn() }));
vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn(),
}));

const prisma = new PrismaClient() as any;

const ENGLISH = /\b(Activities|New Activity|Date|Activity|Project|Activity Type|Start Time|End Time|Duration|Actions|Toggle menu|Start Activity|Delete|N\/A|min|Cancel|Save|Break|Stop Activity|Start|Resume)\b/;

const running = {
  id: "act-1",
  activityName: "Пошук роботи",
  startTime: new Date(Date.now() - 60 * 60 * 1000),
  activityType: { id: "t1", label: "Пошук роботи" },
  breakMinutes: 0,
  breakStartedAt: null,
  breakPlannedMins: null,
};

const context = (over: Record<string, unknown> = {}) => ({
  currentActivity: undefined,
  startActivity: vi.fn(),
  stopActivity: vi.fn(),
  refreshCurrentActivity: vi.fn(),
  isOnBreak: false,
  startBreak: vi.fn(),
  endBreak: vi.fn(),
  setBreakLength: vi.fn(),
  ...over,
});

beforeEach(() => {
  (useActivity as any).mockReturnValue(context());
  (getAllActivityTypes as any).mockResolvedValue([]);
});

describe("Activities in Ukrainian", () => {
  it("the list: heading, toolbar, columns, a date and a duration", async () => {
    setTestLocale("uk");
    (getActivitiesList as any).mockResolvedValue({
      success: true,
      total: 1,
      data: [
        {
          id: "a-1",
          activityName: "Відгуки на вакансії",
          activityType: { id: "t1", label: "Пошук роботи" },
          startTime: new Date(2026, 9, 14, 15, 5),
          endTime: new Date(2026, 9, 14, 16, 35),
          duration: 90,
        },
      ],
    });
    render(<ActivitiesContainer />);

    expect(await screen.findByText("Відгуки на вакансії")).toBeInTheDocument();
    expect(screen.getByText("Активності")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Нова активність/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук активностей…")).toBeInTheDocument();
    for (const header of ["Дата", "Активність", "Початок", "Кінець", "Тривалість", "Дії"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText("14 жовт. 2026")).toBeInTheDocument();
    expect(screen.getByText("15:05")).toBeInTheDocument();
    expect(screen.getByText("16:35")).toBeInTheDocument();
    expect(screen.getByText("1 год 30 хв")).toBeInTheDocument();
    expect(screen.getByTitle("Почати активність")).toBeInTheDocument();
    expect(screen.getByRole("table").textContent).not.toMatch(ENGLISH);
  });

  it("the new-activity dialog", async () => {
    setTestLocale("uk");
    (getActivitiesList as any).mockResolvedValue({ success: true, total: 0, data: [] });
    render(<ActivitiesContainer />);

    await userEvent.click(screen.getByRole("button", { name: /Нова активність/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Додати активність" })).toBeInTheDocument();
    for (const label of ["Назва активності", "Тип активності", "Дата початку", "Час початку", "Дата завершення", "Опис"]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });

  it("the break timer before the break starts", () => {
    setTestLocale("uk");
    (useActivity as any).mockReturnValue(context({ currentActivity: running }));
    render(<BreakModal open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Перерва")).toBeInTheDocument();
    // The play button in the ring and the one below it do the same thing.
    expect(within(dialog).getAllByRole("button", { name: "Почати перерву" })).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Зупинити активність" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "15 хв" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Подовжити перерву" })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(ENGLISH);
  });

  it("the running-activity banner", () => {
    setTestLocale("uk");
    render(
      <ActivityBanner title="Пошук роботи" typeLabel="Пошук роботи" onStopActivity={vi.fn()} onStartBreak={vi.fn()} elapsedTime={3661000} />,
    );
    expect(screen.getByText("1 год 1 хв 1 с")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Зробити перерву" })).toHaveTextContent("Перерва");
    expect(screen.getByRole("button", { name: "Зупинити активність" })).toHaveTextContent("Зупинити активність");
  });
});

describe("Activity actions answer in Ukrainian", () => {
  beforeEach(() => {
    (getCurrentUser as any).mockResolvedValue({ id: "user-id" });
  });

  it.each([
    [5, 3, "Тип активності не можна видалити, бо до нього привʼязано 5 активностей і 3 завдання."],
    [1, 0, "Тип активності не можна видалити, бо до нього привʼязано 1 активність."],
    [0, 21, "Тип активності не можна видалити, бо до нього привʼязано 21 завдання."],
    [2, 11, "Тип активності не можна видалити, бо до нього привʼязано 2 активності і 11 завдань."],
  ])("an activity type in use — %i activities, %i tasks", async (activities, tasks, message) => {
    setTestLocale("uk");
    prisma.activity.count.mockResolvedValue(activities);
    prisma.task.count.mockResolvedValue(tasks);
    expect(await deleteActivityTypeByIdReal("at-1")).toEqual({ success: false, message });
  });

  it("no break to change", async () => {
    setTestLocale("uk");
    prisma.activity.findFirst.mockResolvedValue({ id: "act-1", breakStartedAt: null });
    expect(await updateBreakLengthReal("act-1", 15)).toEqual({ success: false, message: "Перерва зараз не триває." });
  });
});
