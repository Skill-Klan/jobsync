// Requirement — the owner, 2026-11-22 (SKD-71): on «Плани студентів» the admin can
// narrow the list by mentor, next to the search by name. Who is whose mentor
// is the backend's answer (docs/contracts/study-plans-mentors.md): the list of
// mentors arrives with the page, a mentor's students are asked for when the
// mentor is picked, and a student is matched by the cabinet id. «Без ментора»
// is the backend's list of students without one. The filter works together
// with the search; when the backend does not answer, the list stays as it was
// and the admin is told.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  assignStudentPlan: vi.fn(),
  removeStudentPlan: vi.fn(),
  getEntryStudents: vi.fn(),
}));
vi.mock("@/actions/plan.actions", () => actions);
const toasts = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

import StudentPlansAdmin from "@/components/plans/StudentPlansAdmin";

const students = [
  { id: "ann", name: "Анна", cabinetUserId: 1, tracks: [], plans: [] },
  { id: "bob", name: "Богдан", cabinetUserId: 2, tracks: [], plans: [] },
  { id: "bon", name: "Боніфацій", cabinetUserId: 3, tracks: [], plans: [] },
  { id: "dev", name: "Без кабінету", cabinetUserId: null, tracks: [], plans: [] },
];
const mentors = [
  { mentorId: 7, name: "Олена", direction: "Java" },
  { mentorId: 8, name: "Петро", direction: "" },
];

// Olena's students: Anna and Bonifatsii (and one who has no account here at all);
// without a mentor: Bohdan.
const answer = (entry: { kind: string; mentorId?: number }) =>
  entry.kind === "none"
    ? { success: true, data: { students: [{ userId: 2, name: "Богдан" }] } }
    : entry.mentorId === 7
      ? { success: true, data: { students: [{ userId: 1, name: "Анна" }, { userId: 3, name: "Боніфацій" }, { userId: 99, name: "Не заходив" }] } }
      : { success: true, data: { students: [] } };

const render_ = (props: { mentors?: typeof mentors | null } = { mentors }) =>
  render(<StudentPlansAdmin students={students} tracks={[]} {...props} />);
const names = () => screen.getAllByRole("listitem").map((li) => within(li).getAllByText(/./)[0].textContent);

beforeEach(() => {
  actions.getEntryStudents.mockImplementation(async (entry) => answer(entry));
});

describe("the mentor filter", () => {
  it("offers «all», «without a mentor» and every mentor; nothing is asked for until one is picked", () => {
    render_();
    const select = screen.getByRole("combobox", { name: "Filter by mentor" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All mentors",
      "Олена · Java",
      "Петро",
      "Without a mentor",
    ]);
    expect(actions.getEntryStudents).not.toHaveBeenCalled();
    expect(names()).toHaveLength(4);
  });

  it("picking a mentor asks the server for that mentor's students and keeps only those", async () => {
    const user = userEvent.setup();
    render_();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by mentor" }), "Олена · Java");
    expect(actions.getEntryStudents).toHaveBeenCalledWith({ kind: "mentor", mentorId: 7 });
    await waitFor(() => expect(screen.queryByText("Богдан")).not.toBeInTheDocument());
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("Боніфацій")).toBeInTheDocument();
    // not on the mentor's list; and one with no cabinet id never matches
    expect(screen.queryByText("Без кабінету")).not.toBeInTheDocument();
  });

  it("«Without a mentor» asks for the list of students without one", async () => {
    const user = userEvent.setup();
    render_();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by mentor" }), "Without a mentor");
    expect(actions.getEntryStudents).toHaveBeenCalledWith({ kind: "none" });
    await waitFor(() => expect(screen.queryByText("Анна")).not.toBeInTheDocument());
    expect(screen.getByText("Богдан")).toBeInTheDocument();
  });

  it("works together with the search by name", async () => {
    const user = userEvent.setup();
    render_();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by mentor" }), "Олена · Java");
    await waitFor(() => expect(screen.queryByText("Богдан")).not.toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Search for a student" }), "боні");
    expect(screen.getByText("Боніфацій")).toBeInTheDocument();
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
    // «Бог» is Bohdan's, who is not this mentor's: the filter still holds
    await user.clear(screen.getByRole("textbox", { name: "Search for a student" }));
    await user.type(screen.getByRole("textbox", { name: "Search for a student" }), "бог");
    expect(screen.getByText("Nobody found.")).toBeInTheDocument();
  });

  it("a mentor with no students leaves nobody, and says so", async () => {
    const user = userEvent.setup();
    render_();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by mentor" }), "Петро");
    expect(await screen.findByText("Nobody found.")).toBeInTheDocument();
  });

  it("«All mentors» brings everyone back without asking the server again", async () => {
    const user = userEvent.setup();
    render_();
    const select = screen.getByRole("combobox", { name: "Filter by mentor" });
    await user.selectOptions(select, "Олена · Java");
    await waitFor(() => expect(screen.queryByText("Богдан")).not.toBeInTheDocument());
    actions.getEntryStudents.mockClear();
    await user.selectOptions(select, "All mentors");
    expect(names()).toHaveLength(4);
    expect(actions.getEntryStudents).not.toHaveBeenCalled();
  });

  it("when the backend does not answer: the admin is told, the whole list stays and the choice goes back to «all»", async () => {
    actions.getEntryStudents.mockResolvedValue({ success: false, message: "Список не вдалося завантажити." });
    const user = userEvent.setup();
    render_();
    const select = screen.getByRole("combobox", { name: "Filter by mentor" });
    await user.selectOptions(select, "Олена · Java");
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalledWith("Список не вдалося завантажити."));
    expect(names()).toHaveLength(4);
    expect(select).toHaveValue("all");
  });

  it("a call that throws is treated like no answer", async () => {
    actions.getEntryStudents.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render_();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by mentor" }), "Олена · Java");
    await waitFor(() => expect(toasts.toastError).toHaveBeenCalled());
    expect(names()).toHaveLength(4);
  });

  it("a slow answer for a mentor dropped since does not overwrite the current choice", async () => {
    let finishOlena: (v: unknown) => void = () => {};
    actions.getEntryStudents.mockImplementation((entry) =>
      entry.mentorId === 7 ? new Promise((r) => (finishOlena = r)) : Promise.resolve(answer(entry)),
    );
    const user = userEvent.setup();
    render_();
    const select = screen.getByRole("combobox", { name: "Filter by mentor" });
    await user.selectOptions(select, "Олена · Java");
    await user.selectOptions(select, "Without a mentor");
    await waitFor(() => expect(screen.queryByText("Анна")).not.toBeInTheDocument());
    finishOlena(answer({ kind: "mentor", mentorId: 7 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(select).toHaveValue("none");
    expect(names()).toEqual(["Богдан"]);
  });

  it("the list of mentors could not be loaded: the admin is told, the search still works", async () => {
    const user = userEvent.setup();
    render_({ mentors: null });
    expect(screen.getByRole("alert")).toHaveTextContent("The list of mentors could not be loaded");
    expect(screen.queryByRole("combobox", { name: "Filter by mentor" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search for a student" }), "анн");
    expect(screen.getByText("Анна")).toBeInTheDocument();
  });

  it("no list given at all (the viewer has no cabinet id): no filter and no alarm", () => {
    render_({});
    expect(screen.queryByRole("combobox", { name: "Filter by mentor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
