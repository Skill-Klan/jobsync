// Requirement — D89–D93, D95, D98 (docs/contracts/study-plans-mentors.md):
//   · the admin and the QA moderator pick a mentor or «Без ментора»; a mentor
//     also has «Мої студенти»; a student has none of it (the page decides);
//   · a mentor, then a student, then the student's plan — view only: the ticks
//     are shown and cannot be changed, no note can be written, the notes can
//     be read;
//   · a list that could not be loaded says so and shows no student, and is
//     not the same as «no students»;
//   · a student who never signed in: no plan, said so; a student with no name
//     is shown by number;
//   · the page: a student sees their own plan only; the admin / QA moderator /
//     a mentor get the mentor screen; the switch off → 404.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const flags = vi.hoisted(() => ({ plans: true }));
const admin = vi.hoisted(() => ({ value: false }));
const lookup = vi.hoisted(() => ({ viewer: 42 as number | null, value: { canPick: false, mentors: [] as unknown, me: null as unknown } }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => ({ plans: flags.plans })) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => admin.value) }));
vi.mock("@/skillklan/mentorPlans", () => ({
  viewerCabinetId: vi.fn(async () => lookup.viewer),
  loadMentorLookup: vi.fn(async (_v: number, canPick: boolean) => ({ ...lookup.value, canPick })),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/actions/plan.actions", () => ({
  getMyPlans: vi.fn(),
  getEntryStudents: vi.fn(),
  getStudentPlans: vi.fn(),
  setPlanItemDone: vi.fn(),
  setPlanItemNote: vi.fn(),
}));

import PlanPage from "@/app/dashboard/plan/page";
import MentorPlans from "@/components/plans/MentorPlans";
import { getEntryStudents, getMyPlans, getStudentPlans, setPlanItemDone } from "@/actions/plan.actions";

const mentors = [
  { mentorId: 1004, name: "Олена Коваль", direction: "QA" },
  { mentorId: 1002, name: "Ігор Мельник", direction: "BA" },
];
const point = (id: string, title: string, done: boolean, note: string | null = null) => ({
  id, kind: "item", title, materialUrl: null, done, note, children: [],
});
const plan = {
  id: "p1", track: "java", title: "Java",
  modules: [{
    id: "m1", kind: "module", title: "Модуль 1. Основи", materialUrl: null, done: false, note: null,
    children: [{ id: "t1", kind: "topic", title: "Тема 1", materialUrl: null, done: false, note: null,
      children: [point("i1", "Зробити перше", true, "Нотатка студента"), point("i2", "Зробити друге", false)] }],
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  flags.plans = true;
  admin.value = false;
  lookup.viewer = 42;
  lookup.value = { canPick: false, mentors: [], me: null };
  vi.mocked(getMyPlans).mockResolvedValue({ success: true, data: [] });
  vi.mocked(getEntryStudents).mockResolvedValue({ success: true, data: { students: [{ userId: 1001, name: "Марія Бондар" }, { userId: 1002, name: "" }] } });
  vi.mocked(getStudentPlans).mockResolvedValue({ success: true, data: { name: "Марія Бондар", hasAccount: true, plans: [plan] as never } });
});

describe("the screen", () => {
  it("the admin / QA moderator: every mentor the backend gave, and «Without a mentor»; nothing is read until one is picked", () => {
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    expect(screen.getByRole("button", { name: "Олена Коваль · QA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ігор Мельник · BA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Without a mentor" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My students" })).not.toBeInTheDocument();
    expect(getEntryStudents).not.toHaveBeenCalled();
  });

  it("a mentor who cannot pick: only «My students»", () => {
    render(<MentorPlans mentors={[]} me={{ mentorId: 1004, name: "Test Mentor", direction: "QA" }} canPick={false} />);
    expect(screen.getByRole("button", { name: "My students" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Without a mentor" })).not.toBeInTheDocument();
    expect(screen.getByText("Press «My students».")).toBeInTheDocument();
    expect(screen.queryByText(/Pick a mentor or/)).not.toBeInTheDocument();
  });

  it("an admin who mentors: «My students» once, not twice in the list", () => {
    render(<MentorPlans mentors={mentors} me={{ mentorId: 1002, name: "Ігор Мельник", direction: "BA" }} canPick />);
    expect(screen.getByRole("button", { name: "My students" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ігор Мельник · BA" })).not.toBeInTheDocument();
  });

  it("a list of mentors that could not be loaded says so (and is not «no mentors»)", () => {
    const { unmount } = render(<MentorPlans mentors={null} me={null} canPick />);
    expect(screen.getByRole("alert")).toHaveTextContent(/mentors could not be loaded/i);
    expect(screen.queryByText(/no mentors to show/i)).not.toBeInTheDocument();
    unmount();
    render(<MentorPlans mentors={[]} me={null} canPick />);
    expect(screen.getByText(/no mentors to show/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a mentor → their students; a student with no name is shown by number", async () => {
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    await userEvent.click(screen.getByRole("button", { name: "Олена Коваль · QA" }));
    expect(getEntryStudents).toHaveBeenCalledWith({ kind: "mentor", mentorId: 1004 });
    expect(await screen.findByRole("button", { name: "Марія Бондар" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No name (no. 1002)" })).toBeInTheDocument();
  });

  it("«Without a mentor» asks for that list; «My students» asks for the viewer's own mentor id", async () => {
    render(<MentorPlans mentors={mentors} me={{ mentorId: 1010, name: "Я", direction: "QA" }} canPick />);
    await userEvent.click(screen.getByRole("button", { name: "Without a mentor" }));
    expect(getEntryStudents).toHaveBeenLastCalledWith({ kind: "none" });
    await userEvent.click(screen.getByRole("button", { name: "My students" }));
    expect(getEntryStudents).toHaveBeenLastCalledWith({ kind: "mentor", mentorId: 1010 });
  });

  it("a list that could not be loaded: the notice, no students; an empty list: «no students»", async () => {
    vi.mocked(getEntryStudents).mockResolvedValueOnce({ success: false, message: "The list could not be loaded. Try again later." });
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    await userEvent.click(screen.getByRole("button", { name: "Олена Коваль · QA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText("No students in this list.")).not.toBeInTheDocument();

    vi.mocked(getEntryStudents).mockResolvedValueOnce({ success: true, data: { students: [] } });
    await userEvent.click(screen.getByRole("button", { name: "Ігор Мельник · BA" }));
    expect(await screen.findByText(/has no students/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a student's plan is view only: ticks shown and disabled, the note readable, nothing can be written", async () => {
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Олена Коваль · QA" }));
    await u.click(await screen.findByRole("button", { name: "Марія Бондар" }));
    expect(getStudentPlans).toHaveBeenCalledWith({ kind: "mentor", mentorId: 1004 }, 1001);

    expect(await screen.findByRole("heading", { name: "View only: Марія Бондар" })).toBeInTheDocument();
    await u.click(await screen.findByText("Тема 1"));
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).toBeDisabled();
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(screen.getByText("Нотатка студента")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /note/i })).not.toBeInTheDocument();
    await u.click(boxes[1]);
    expect(setPlanItemDone).not.toHaveBeenCalled();
  });

  it("a student who never signed in, a student with no plan, a plan that cannot be opened — each said, none an empty page", async () => {
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Олена Коваль · QA" }));

    vi.mocked(getStudentPlans).mockResolvedValueOnce({ success: true, data: { name: "Марія", hasAccount: false, plans: [] } });
    await u.click(await screen.findByRole("button", { name: "Марія Бондар" }));
    expect(await screen.findByText(/has not signed in/i)).toBeInTheDocument();

    vi.mocked(getStudentPlans).mockResolvedValueOnce({ success: true, data: { name: "Марія", hasAccount: true, plans: [] } });
    await u.click(screen.getByRole("button", { name: "No name (no. 1002)" }));
    expect(await screen.findByText(/no plan yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/has not signed in/i)).not.toBeInTheDocument();

    vi.mocked(getStudentPlans).mockResolvedValueOnce({ success: false, message: "This student's plan is not available." });
    await u.click(screen.getByRole("button", { name: "Марія Бондар" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not available");
  });

  it("switching to another student does not keep the first one's plan on screen", async () => {
    render(<MentorPlans mentors={mentors} me={null} canPick />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Олена Коваль · QA" }));
    await u.click(await screen.findByRole("button", { name: "Марія Бондар" }));
    await screen.findByRole("heading", { name: "View only: Марія Бондар" });
    let release: (v: never) => void = () => {};
    vi.mocked(getStudentPlans).mockReturnValueOnce(new Promise((r) => (release = r as never)));
    await u.click(screen.getByRole("button", { name: "No name (no. 1002)" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "View only: Марія Бондар" })).not.toBeInTheDocument());
    release({ success: true, data: { name: "", hasAccount: true, plans: [] } } as never);
  });
});

describe("the page", () => {
  it("a student: their own plan, no mentor screen", async () => {
    lookup.value = { canPick: false, mentors: [], me: null };
    vi.mocked(getMyPlans).mockResolvedValue({ success: true, data: [plan] as never });
    render(await PlanPage());
    expect(screen.getByRole("heading", { name: "Study plan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Without a mentor" })).not.toBeInTheDocument();
  });

  it("the admin / QA moderator: the mentor screen with the backend's mentors", async () => {
    admin.value = true;
    lookup.value = { canPick: true, mentors, me: null };
    render(await PlanPage());
    expect(screen.getByRole("heading", { name: "Students' plans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Олена Коваль · QA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Without a mentor" })).toBeInTheDocument();
  });

  it("a mentor who is not an admin: «My students» only, and their own plan under it when they have one", async () => {
    lookup.value = { canPick: false, mentors: [], me: { mentorId: 1004, name: "Test Mentor", direction: "QA" } };
    vi.mocked(getMyPlans).mockResolvedValue({ success: true, data: [plan] as never });
    render(await PlanPage());
    expect(screen.getByRole("button", { name: "My students" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Without a mentor" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My own plan" })).toBeInTheDocument();
  });

  it("an account with no cabinet id (dev password) gets the plain page, and nobody asked the backend", async () => {
    admin.value = true;
    lookup.viewer = null;
    render(await PlanPage());
    expect(screen.queryByRole("heading", { name: "Students' plans" })).not.toBeInTheDocument();
    expect(screen.getByText(/has not given you a study plan/i)).toBeInTheDocument();
  });

  it("the switch off → 404, whoever asks", async () => {
    flags.plans = false;
    admin.value = true;
    await expect(PlanPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
