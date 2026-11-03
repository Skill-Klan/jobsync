// Requirement — product notes, 2026-11-03: the study plan covers what a student
// has to go through, so the admin must be able to close «Завдання» too, in
// Settings → «Функції», switch `tasks`:
//   · on at launch — nothing a student already has disappears until the admin
//     decides;
//   · off: no menu item, the page answers 404 and reads nothing, no «Add task»
//     on the dashboard (and its sentence stops naming tasks), and every action
//     that changes a task refuses — a page opened before the switch went off
//     still has its buttons — and writes nothing;
//   · the tasks stay in the database; switched back on they are all there;
//   · closing Tasks does not close anything else, and nothing else closes Tasks.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FEATURES, resolveFeatureFlags, type FeatureFlags } from "@/skillklan/features";

const flags = vi.hoisted(() => ({
  value: { automations: true, activities: true, library: true, plans: true, tasks: true, catalog: true } as FeatureFlags,
}));
const db = vi.hoisted(() => {
  const model = () => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  });
  return { task: model(), activity: model() };
});

vi.mock("@/skillklan/featureFlags", () => ({
  getFeatureFlags: vi.fn(async () => flags.value),
  isFeatureOff: vi.fn(async (key: keyof FeatureFlags) => !flags.value[key]),
}));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => false) }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("../../src/actions/shared", () => ({ requireUser: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: vi.fn(() => "/dashboard"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock("@/actions/activity.actions", () => ({ getAllActivityTypes: vi.fn(async () => []) }));
vi.mock("@/actions/task.actions", async (original) => ({
  ...(await original<typeof import("@/actions/task.actions")>()),
  getActivityTypesWithTaskCounts: vi.fn(async () => ({ data: [], totalTasks: 0 })),
}));
vi.mock("@/app/dashboard/tasks/TasksPageClient", () => ({ default: () => <div data-testid="tasks" /> }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));

import TasksPage from "@/app/dashboard/tasks/page";
import Header from "@/components/Header";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { createTask, deleteTaskById, updateTask, updateTaskStatus } from "@/actions/task/mutations";
import { startActivityFromTask } from "@/actions/task/activity";
import { getActivityTypesWithTaskCounts } from "@/actions/task.actions";

const ON: FeatureFlags = { automations: true, activities: true, library: true, plans: true, tasks: true, catalog: true };

beforeEach(() => {
  flags.value = { ...ON };
  vi.clearAllMocks();
});

describe("the default", () => {
  it("Tasks is on when the admin has chosen nothing, the others as before", () => {
    expect(FEATURES.tasks.default).toBe(true);
    expect(resolveFeatureFlags([])).toEqual({
      automations: false,
      activities: false,
      library: false,
      plans: false,
      tasks: true,
      catalog: false,
    });
  });

  it("the admin's choice turns it off, and only it", () => {
    expect(resolveFeatureFlags([{ key: "tasks", enabled: false }])).toMatchObject({ tasks: false, plans: false });
    expect(resolveFeatureFlags([{ key: "plans", enabled: true }]).tasks).toBe(true);
  });
});

describe("the page", () => {
  it("off → not there (404) and nothing is read", async () => {
    flags.value = { ...ON, tasks: false };
    await expect(TasksPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getActivityTypesWithTaskCounts).not.toHaveBeenCalled();
  });

  it("on → the page, even with every other switch off", async () => {
    flags.value = { automations: false, activities: false, library: false, plans: false, tasks: true, catalog: false };
    render(await TasksPage());
    expect(screen.getByTestId("tasks")).toBeInTheDocument();
  });
});

describe("the phone menu", () => {
  const open = async () => {
    render(await Header());
    await userEvent.setup().click(screen.getByRole("button", { name: "Toggle Menu" }));
  };

  it("on → «Tasks» is there", async () => {
    await open();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });

  it("off → «Tasks» is gone, the rest of the menu stays", async () => {
    flags.value = { ...ON, tasks: false };
    await open();
    expect(screen.queryByRole("link", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Questions" })).toBeInTheDocument();
  });

  it("another switch off does not take «Tasks» away", async () => {
    flags.value = { ...ON, plans: false, activities: false };
    await open();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });
});

describe("the dashboard", () => {
  const card = (value: FeatureFlags) =>
    render(
      <FeaturesProvider value={value}>
        <JobsAppliedCard />
      </FeaturesProvider>,
    );

  it("on → «Add task» and a sentence that names tasks", () => {
    card(ON);
    expect(screen.getByRole("button", { name: /Add task/i })).toBeInTheDocument();
    expect(screen.getByText("Create new jobs, automations, tasks, activities, questions, and contacts.")).toBeInTheDocument();
  });

  it("off → no «Add task», the other buttons stay, the sentence no longer names tasks", () => {
    card({ ...ON, tasks: false });
    expect(screen.queryByRole("button", { name: /Add task/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add job/i })).toBeInTheDocument();
    expect(screen.getByText("Create new jobs, automations, activities, questions, and contacts.")).toBeInTheDocument();
  });

  it.each([
    [{ automations: false }, "Create new jobs, tasks, activities, questions, and contacts."],
    [{ activities: false }, "Create new jobs, automations, tasks, questions, and contacts."],
    [{ automations: false, tasks: false }, "Create new jobs, activities, questions, and contacts."],
    [{ activities: false, tasks: false }, "Create new jobs, automations, questions, and contacts."],
    [{ automations: false, activities: false, tasks: false }, "Create new jobs, questions, and contacts."],
  ])("every mix of switches names only the buttons shown: %j", (change, sentence) => {
    card({ ...ON, ...change });
    expect(screen.getByText(sentence)).toBeInTheDocument();
  });
});

describe("the actions", () => {
  const TASK = { title: "Resume", status: "in-progress", priority: 1, percentComplete: 0 } as never;
  const calls: [string, () => Promise<unknown>][] = [
    ["add a task", () => createTask(TASK)],
    ["change a task", () => updateTask({ ...(TASK as object), id: "task-1" } as never)],
    ["change a task's status", () => updateTaskStatus("task-1", "complete" as never)],
    ["delete a task", () => deleteTaskById("task-1")],
    ["start an activity from a task", () => startActivityFromTask("task-1")],
  ];
  const touched = () => Object.values(db).flatMap((m) => Object.values(m).flatMap((fn) => fn.mock.calls));

  it.each(calls)("off → %s is refused and the database is not touched", async (_name, call) => {
    flags.value = { ...ON, tasks: false };
    expect(await call()).toEqual({ success: false, message: "Tasks are switched off. Reload the page." });
    expect(touched()).toHaveLength(0);
  });

  it.each(calls)("on → %s reaches the database", async (_name, call) => {
    db.task.create.mockResolvedValue({ id: "task-1" });
    db.task.update.mockResolvedValue({ id: "task-1" });
    db.task.findFirst.mockResolvedValue(null);
    await call();
    expect(touched().length).toBeGreaterThan(0);
  });

  it("another switch off does not close the actions", async () => {
    flags.value = { ...ON, plans: false, library: false, automations: false };
    db.task.create.mockResolvedValue({ id: "task-1" });
    expect(await createTask(TASK)).toMatchObject({ success: true });
  });
});
