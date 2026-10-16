// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// the Tasks screen, the task dialog and the messages its server actions return
// speak Ukrainian. Tasks → «Завдання», Add → «Додати», Save → «Зберегти»,
// Cancel → «Скасувати»; dates put the day first and use 24-hour time.
import { render, screen, within } from "@testing-library/react";
import TasksContainer from "@/components/tasks/TasksContainer";
import TasksTable from "@/components/tasks/TasksTable";
import TasksSidebar from "@/components/tasks/TasksSidebar";
import { TaskForm } from "@/components/tasks/TaskForm";
import { getTasksList } from "@/actions/task.actions";
import { startActivityFromTask as startActivityFromTaskReal } from "@/actions/task/activity";
import { deleteTaskById as deleteTaskByIdReal } from "@/actions/task/mutations";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import type { Task } from "@/models/task.model";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/task.actions", () => ({
  getTasksList: vi.fn(),
  getTaskById: vi.fn(),
  deleteTaskById: vi.fn(),
  updateTaskStatus: vi.fn(),
  startActivityFromTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));
// SkillKlan feature switches: Activities on — these tests are about the
// actions themselves; switched off is __tests__/skillklan/activitiesSwitchActions.spec.ts.
vi.mock("@/skillklan/featureFlags", () => ({ isFeatureOff: vi.fn(async () => false) }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@prisma/client", () => {
  const client = {
    task: { findFirst: vi.fn(), delete: vi.fn() },
    activity: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock("@/context/ActivityContext", () => ({
  useActivity: vi.fn(() => ({ refreshCurrentActivity: vi.fn() })),
}));

const prisma = new PrismaClient() as any;

const activityType = { id: "type-1", label: "Розробка", value: "розробка", createdAt: new Date(), updatedAt: new Date() };

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: "task-1",
    userId: "user-id",
    title: "Оновити резюме",
    description: "",
    status: "in-progress",
    priority: 5,
    percentComplete: 50,
    dueDate: null,
    activityTypeId: "type-1",
    activityType,
    activities: [],
    createdAt: new Date(2026, 9, 14, 15, 5),
    updatedAt: new Date(2026, 9, 14, 15, 5),
    ...over,
  }) as Task;

// Words the screens had in English; none of them may survive in Ukrainian.
const ENGLISH = /\b(Tasks|New Task|Title|Activity Type|Status|Priority|Complete|In Progress|Needs Attention|Toggle menu|Actions|Start Activity|No tasks found|Add Task|Edit Task|Cancel|Save|Due Date|Created|Updated|Description)\b/;

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

describe("Tasks in Ukrainian", () => {
  it("the list: heading, toolbar, column headers and statuses", async () => {
    setTestLocale("uk");
    (getTasksList as any).mockResolvedValue({
      success: true,
      data: [task(), task({ id: "task-2", title: "Підготуватися до співбесіди", status: "needs-attention" })],
      total: 2,
    });
    render(<TasksContainer activityTypes={[activityType]} />);

    expect(await screen.findByText("Оновити резюме")).toBeInTheDocument();
    expect(screen.getByText("Завдання")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Нове завдання/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук завдань…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Статус/ })).toBeInTheDocument();
    for (const header of ["Назва", "Тип активності", "Пріоритет", "% виконання"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText("У роботі")).toBeInTheDocument();
    expect(screen.getByText("Потребує уваги")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Позначити як виконане" })).toHaveLength(2);
    expect(screen.getAllByTitle("Почати активність")).toHaveLength(2);

    const table = screen.getByRole("table");
    expect(table.textContent).not.toMatch(ENGLISH);
  });

  it("an empty list says so in Ukrainian", async () => {
    setTestLocale("uk");
    (getTasksList as any).mockResolvedValue({ success: true, data: [], total: 0 });
    const { container } = render(<TasksContainer activityTypes={[]} />);

    expect(
      await screen.findByText("Завдань не знайдено. Створіть перше завдання, щоб почати."),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("grouped by due date — the group names are Ukrainian", () => {
    setTestLocale("uk");
    render(
      <TasksTable
        tasks={[task()]}
        deleteTask={vi.fn()}
        editTask={vi.fn()}
        onChangeTaskStatus={vi.fn()}
        onStartActivity={vi.fn()}
        groupBy="dueDate"
      />,
    );
    expect(screen.getByRole("heading", { name: "Без терміну (1)" })).toBeInTheDocument();
  });

  it("the sidebar", () => {
    setTestLocale("uk");
    render(
      <TasksSidebar
        activityTypes={[{ id: "type-1", label: "Розробка", value: "розробка", taskCount: 2 }]}
        totalTasks={2}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Типи активностей")).toBeInTheDocument();
    expect(screen.getByText("Усі")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Згорнути панель" })).toBeInTheDocument();
  });

  it("the dialog: adding a task", () => {
    setTestLocale("uk");
    render(
      <TaskForm
        activityTypes={[activityType]}
        resetEditTask={vi.fn()}
        onTaskSaved={vi.fn()}
        dialogOpen
        setDialogOpen={vi.fn()}
        onSaveAndStart={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Додати завдання" })).toBeInTheDocument();
    expect(within(dialog).getByText("Додайте нове завдання, щоб відстежувати його.")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Введіть назву завдання")).toBeInTheDocument();
    expect(within(dialog).getByText("Термін")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти й почати" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });

  it("the dialog: editing shows when the task was created, day first, 24-hour", () => {
    setTestLocale("uk");
    render(
      <TaskForm
        activityTypes={[activityType]}
        editTask={task()}
        resetEditTask={vi.fn()}
        onTaskSaved={vi.fn()}
        dialogOpen
        setDialogOpen={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Редагувати завдання" })).toBeInTheDocument();
    expect(within(dialog).getByText("Створено")).toBeInTheDocument();
    expect(within(dialog).getAllByText("14 жовт. 2026, 15:05")).toHaveLength(2);
  });
});

describe("Task actions answer in Ukrainian", () => {
  beforeEach(() => {
    (getCurrentUser as any).mockResolvedValue({ id: "user-id" });
  });

  it("a task with a linked activity cannot be deleted", async () => {
    setTestLocale("uk");
    prisma.task.findFirst.mockResolvedValue({ id: "task-1", activities: [{ id: "a-1" }] });
    expect(await deleteTaskByIdReal("task-1")).toEqual({
      success: false,
      message: "Не можна видалити завдання, до якого привʼязана активність. Спершу видаліть активність.",
    });
  });

  it("a completed task cannot start an activity", async () => {
    setTestLocale("uk");
    prisma.task.findFirst.mockResolvedValue({ id: "task-1", status: "complete", activityTypeId: "type-1" });
    expect(await startActivityFromTaskReal("task-1")).toEqual({
      success: false,
      message: "Не можна почати активність із виконаного чи скасованого завдання.",
    });
  });
});
