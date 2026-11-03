// Requirement — product notes, 2026-11-02: the student sees their plan with a
// tab per module and its percent, topics that open, a tick and a note on each
// point and homework task; the progress follows the ticks at once and goes
// back when saving fails. The admin sees the students and the plans each
// holds, and gives a plan with a button — a plan already given has none, and offers to take it back.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setTestLocale } from "../helpers/i18n";

const actions = vi.hoisted(() => ({
  setPlanItemDone: vi.fn(),
  setPlanItemNote: vi.fn(),
  assignStudentPlan: vi.fn(),
  removeStudentPlan: vi.fn(),
}));
vi.mock("@/actions/plan.actions", () => actions);
const toasts = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

import PlanView from "@/components/plans/PlanView";
import StudentPlansAdmin from "@/components/plans/StudentPlansAdmin";
import type { PlanItemView } from "@/skillklan/plans/tree";

const node = (id: string, kind: PlanItemView["kind"], children: PlanItemView[] = [], extra: Partial<PlanItemView> = {}): PlanItemView => ({
  id, kind, title: `T-${id}`, materialUrl: null, done: false, note: null, children, ...extra,
});

// Module 1: points a (done), b, c in a group, homework with h1 (done) and h2 — 2 of 5 → 40%.
const plan = () => ({
  id: "plan-1",
  track: "java",
  title: "Java",
  modules: [
    node("m1", "module", [
      node("t1", "topic", [
        node("a", "item", [], { done: true }),
        node("b", "item"),
        node("g", "group", [node("c", "item")]),
        node("hw", "homework", [node("h1", "homework_task", [], { done: true }), node("h2", "homework_task")]),
        node("ref", "homework_ref", [], { title: "ДЗ 1 — завдання в іншій темі" }),
      ], { materialUrl: "https://docs.example.test/t1" }),
    ], { title: "Модуль 1. Основи" }),
    node("m2", "module", [node("t2", "topic", [node("d", "item")])], { title: "Модуль 2: Далі" }),
  ],
});

beforeEach(() => {
  actions.setPlanItemDone.mockResolvedValue({ success: true });
  actions.setPlanItemNote.mockResolvedValue({ success: true });
  actions.assignStudentPlan.mockResolvedValue({ success: true });
});

describe("the student's page", () => {
  it("a tab per module with its percent, and the overall progress", () => {
    render(<PlanView plans={[plan()]} />);
    expect(screen.getByRole("tab", { name: /Модуль 1\s*40%/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Модуль 2\s*0%/ })).toBeInTheDocument();
    // 2 of 6 points overall
    expect(screen.getByText("2 of 6 done · 33%")).toBeInTheDocument();
  });

  it("a topic opens to its points, group, homework and pointer; the pointer has no tick; the material is a link", async () => {
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    expect(screen.queryByText("T-b")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByText("ДЗ 1 — завдання в іншій темі")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Material for the topic" });
    expect(link).toHaveAttribute("href", "https://docs.example.test/t1");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("checkbox", { name: "Mark as done: T-a" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mark as done: T-b" })).not.toBeChecked();
  });

  it("ticking saves, and the counters move at once", async () => {
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    await user.click(screen.getByRole("checkbox", { name: "Mark as done: T-b" }));
    expect(actions.setPlanItemDone).toHaveBeenCalledWith("b", true);
    expect(screen.getByRole("tab", { name: /Модуль 1\s*60%/ })).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("unticking a done point saves false", async () => {
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    await user.click(screen.getByRole("checkbox", { name: "Mark as done: T-a" }));
    expect(actions.setPlanItemDone).toHaveBeenCalledWith("a", false);
    expect(screen.getByRole("tab", { name: /Модуль 1\s*20%/ })).toBeInTheDocument();
  });

  it("a refused save puts the tick back and says why", async () => {
    actions.setPlanItemDone.mockResolvedValue({ success: false, message: "Не вдалося зберегти." });
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    await user.click(screen.getByRole("checkbox", { name: "Mark as done: T-b" }));
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalledWith("Не вдалося зберегти."));
    expect(screen.getByRole("checkbox", { name: "Mark as done: T-b" })).not.toBeChecked();
    expect(screen.getByRole("tab", { name: /Модуль 1\s*40%/ })).toBeInTheDocument();
  });

  it("a note: open the editor, type, save — it is stored and shown", async () => {
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    const row = screen.getByRole("checkbox", { name: "Mark as done: T-b" }).closest("div")!.parentElement!;
    await user.click(within(row).getByRole("button", { name: "Add a note" }));
    await user.type(screen.getByRole("textbox", { name: "Note on “T-b”" }), "розібрався з Scrum");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.setPlanItemNote).toHaveBeenCalledWith("b", "розібрався з Scrum");
    expect(await screen.findByText("розібрався з Scrum")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit the note" })).toBeInTheDocument();
  });

  it("a note that could not be saved keeps the editor open", async () => {
    actions.setPlanItemNote.mockResolvedValue({ success: false, message: "Нотатка задовга." });
    const user = userEvent.setup();
    render(<PlanView plans={[plan()]} />);
    await user.click(screen.getByRole("button", { name: /T-t1/ }));
    await user.click(within(screen.getByRole("checkbox", { name: "Mark as done: T-b" }).closest("div")!.parentElement!).getByRole("button", { name: "Add a note" }));
    await user.type(screen.getByRole("textbox", { name: "Note on “T-b”" }), "текст");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalledWith("Нотатка задовга."));
    expect(screen.getByRole("textbox", { name: "Note on “T-b”" })).toHaveValue("текст");
  });

  it("no plan yet: says so, in Ukrainian too", () => {
    setTestLocale("uk");
    render(<PlanView plans={[]} />);
    expect(screen.getByText(/Менеджер ще не видав вам навчальний план/)).toBeInTheDocument();
  });
});

describe("the admin's page", () => {
  const students = [
    { id: "ann", name: "Анна", cabinetUserId: 1, tracks: ["java"], plans: [{ track: "java", done: 12, notes: 1 }] },
    { id: "bob", name: "Богдан", cabinetUserId: 2, tracks: [], plans: [] },
    { id: "dev", name: "", cabinetUserId: null, tracks: [], plans: [] },
  ];
  const tracks = [{ track: "java", title: "Java" }];

  it("shows who holds which plan; the button is only where the plan is missing", () => {
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const ann = screen.getByText("Анна").closest("li")!;
    expect(within(ann).getByText(/Java — given/)).toBeInTheDocument();
    expect(within(ann).queryByRole("button", { name: /Give/ })).not.toBeInTheDocument();
    const bob = screen.getByText("Богдан").closest("li")!;
    expect(within(bob).getByText(/No plan yet/)).toBeInTheDocument();
    expect(within(bob).getByRole("button", { name: "Give the “Java” plan" })).toBeInTheDocument();
    expect(screen.getByText("No name")).toBeInTheDocument();
  });

  it("giving a plan asks the server for that student and track, then shows it as given", async () => {
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const bob = screen.getByText("Богдан").closest("li")!;
    await user.click(within(bob).getByRole("button", { name: "Give the “Java” plan" }));
    expect(actions.assignStudentPlan).toHaveBeenCalledWith("bob", "java");
    await waitFor(() => expect(within(bob).queryByRole("button", { name: /Give/ })).not.toBeInTheDocument());
    expect(within(bob).getByText(/Java — given/)).toBeInTheDocument();
    expect(toasts.toastSuccess).toHaveBeenCalled();
  });

  it("a refusal says why and leaves the button", async () => {
    actions.assignStudentPlan.mockResolvedValue({ success: false, message: "Видавати плани можуть лише адміністратор." });
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const bob = screen.getByText("Богдан").closest("li")!;
    await user.click(within(bob).getByRole("button", { name: "Give the “Java” plan" }));
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalledWith("Видавати плани можуть лише адміністратор."));
    expect(within(bob).getByRole("button", { name: "Give the “Java” plan" })).toBeInTheDocument();
  });

  it("taking a plan back: the button is only where the plan is held, and asks first, saying what is lost", async () => {
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const bob = screen.getByText("Богдан").closest("li")!;
    expect(within(bob).queryByRole("button", { name: /Take back/ })).not.toBeInTheDocument();
    const ann = screen.getByText("Анна").closest("li")!;
    await user.click(within(ann).getByRole("button", { name: "Take back the “Java” plan from Анна" }));
    expect(actions.removeStudentPlan).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Take back the “Java” plan?")).toBeInTheDocument();
    expect(within(dialog).getByText(/12 points are ticked and there is 1 note/)).toBeInTheDocument();
  });

  it("cancelling the question takes nothing back", async () => {
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const ann = screen.getByText("Анна").closest("li")!;
    await user.click(within(ann).getByRole("button", { name: /Take back/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(actions.removeStudentPlan).not.toHaveBeenCalled();
    expect(within(ann).getByText(/Java — given/)).toBeInTheDocument();
  });

  it("confirming takes it back and offers to give it again", async () => {
    actions.removeStudentPlan.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const ann = screen.getByText("Анна").closest("li")!;
    await user.click(within(ann).getByRole("button", { name: /Take back/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Take back" }));
    expect(actions.removeStudentPlan).toHaveBeenCalledWith("ann", "java");
    await waitFor(() => expect(within(ann).getByRole("button", { name: "Give the “Java” plan" })).toBeInTheDocument());
    expect(within(ann).getByText(/No plan yet/)).toBeInTheDocument();
  });

  it("a refusal says why and the plan stays", async () => {
    actions.removeStudentPlan.mockResolvedValue({ success: false, message: "Тільки адміністратор." });
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    const ann = screen.getByText("Анна").closest("li")!;
    await user.click(within(ann).getByRole("button", { name: /Take back/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Take back" }));
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalledWith("Тільки адміністратор."));
    expect(within(ann).getByText(/Java — given/)).toBeInTheDocument();
  });

  it("search narrows the list by name; nobody found says so", async () => {
    const user = userEvent.setup();
    render(<StudentPlansAdmin students={students} tracks={tracks} />);
    await user.type(screen.getByRole("textbox", { name: "Search for a student" }), "бог");
    expect(screen.getByText("Богдан")).toBeInTheDocument();
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Search for a student" }));
    await user.type(screen.getByRole("textbox", { name: "Search for a student" }), "яяя");
    expect(screen.getByText("Nobody found.")).toBeInTheDocument();
  });
});
