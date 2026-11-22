// Requirement — the owner, 2026-11-22 (SKD-60): the admin sends the school's
// workbook, sees which student each tab goes to and what would be ticked, and
// only then confirms:
//   · nothing is imported by choosing a file or by the preview;
//   · the preselected student is the one confirmed; the admin may change it or
//     skip a tab; only the tabs with a student go with the confirmation;
//   · no student chosen → nothing to confirm; a tab no cabinet student fits says so;
//   · the screen is on the mentor screen for the admin only (canPick).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/actions/plan.actions", () => ({
  getMyPlans: vi.fn(),
  getEntryStudents: vi.fn(),
  getStudentPlans: vi.fn(),
  setPlanItemDone: vi.fn(),
  setPlanItemNote: vi.fn(),
  setStudentPlanItemDone: vi.fn(),
  setStudentPlanItemNote: vi.fn(),
  previewPlanImport: vi.fn(),
  applyPlanImport: vi.fn(),
}));

import MentorPlans from "@/components/plans/MentorPlans";
import { applyPlanImport, previewPlanImport } from "@/actions/plan.actions";

const tracks = [{ track: "java", title: "Java" }];
const preview = {
  tabs: [
    {
      tab: "Марія (Борис)", passed: 32, preselected: 501, account: false, plan: false, willMark: 32, alreadyDone: 0, missing: [],
      candidates: [{ userId: 501, name: "Марія Перша", mentors: ["Борис Тестовий"] }],
    },
    {
      tab: "Іван", passed: 5, preselected: null, account: true, plan: true, willMark: 3, alreadyDone: 2, missing: [{ topic: "T", text: "x" }],
      candidates: [
        { userId: 601, name: "Іван Перший", mentors: [] },
        { userId: 602, name: "Іван Другий", mentors: [] },
      ],
    },
    { tab: "Олег", passed: 7, preselected: null, account: false, plan: false, willMark: 7, alreadyDone: 0, missing: [], candidates: [] },
  ],
  skipped: [{ tab: "Вікторія", reason: "noProgress" as const }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(previewPlanImport).mockResolvedValue({ success: true, data: preview });
  vi.mocked(applyPlanImport).mockResolvedValue({ success: true, data: { results: [] } });
});

async function openPreview() {
  const user = userEvent.setup();
  render(<MentorPlans mentors={[]} me={null} canPick importTracks={tracks} />);
  await user.click(screen.getByRole("button", { name: "Import from a spreadsheet" }));
  await user.upload(screen.getByLabelText(".xlsx file"), new File(["x"], "Java.xlsx"));
  await user.click(screen.getByRole("button", { name: "Preview" }));
  await screen.findByText("Марія (Борис)");
  return user;
}

describe("the import screen", () => {
  it("is offered to the admin only", () => {
    const { unmount } = render(<MentorPlans mentors={[]} me={null} canPick importTracks={tracks} />);
    expect(screen.getByRole("button", { name: "Import from a spreadsheet" })).toBeInTheDocument();
    unmount();
    render(<MentorPlans mentors={[]} me={{ mentorId: 1, name: "M", direction: "QA" }} canPick={false} importTracks={tracks} />);
    expect(screen.queryByRole("button", { name: "Import from a spreadsheet" })).not.toBeInTheDocument();
  });

  it("choosing a file and previewing import nothing; the preview shows tabs, counts and skipped tabs", async () => {
    await openPreview();
    expect(previewPlanImport).toHaveBeenCalledTimes(1);
    expect(applyPlanImport).not.toHaveBeenCalled();
    expect(screen.getByText("Not found in the plan: 1")).toBeInTheDocument();
    expect(screen.getByText(/Skipped — no passed point in these tabs: Вікторія/)).toBeInTheDocument();
    expect(screen.getByText("Not in the cabinet's lists")).toBeInTheDocument();
    expect(screen.getByText(/already has the plan — only the rest is ticked \(2 already ticked\)/)).toBeInTheDocument();
  });

  it("confirms only the tabs that have a student: the preselected one and the one the admin chose", async () => {
    const user = await openPreview();
    expect(screen.getByRole("button", { name: "Import (1)" })).toBeEnabled();
    await user.selectOptions(screen.getByLabelText("Student in the cabinet: Іван"), "602");
    await user.click(screen.getByRole("button", { name: "Import (2)" }));
    await waitFor(() => expect(applyPlanImport).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(applyPlanImport).mock.calls[0][0] as FormData;
    expect(JSON.parse(sent.get("picks") as string)).toEqual([
      { tab: "Марія (Борис)", userId: 501 },
      { tab: "Іван", userId: 602 },
    ]);
    expect(sent.get("track")).toBe("java");
  });

  it("skipping every tab leaves nothing to confirm", async () => {
    const user = await openPreview();
    await user.selectOptions(screen.getByLabelText("Student in the cabinet: Марія (Борис)"), "");
    expect(screen.getByRole("button", { name: "Import (0)" })).toBeDisabled();
    expect(applyPlanImport).not.toHaveBeenCalled();
  });

  it("shows what was done after the import", async () => {
    vi.mocked(applyPlanImport).mockResolvedValue({
      success: true,
      data: { results: [{ tab: "Марія (Борис)", name: "Марія Перша", ok: true, accountCreated: true, planCreated: true, marked: 32, alreadyDone: 0, missing: 0 }] },
    });
    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: "Import (1)" }));
    expect(await screen.findByText("Марія Перша: 32 ticked, account created, plan given")).toBeInTheDocument();
  });
});
