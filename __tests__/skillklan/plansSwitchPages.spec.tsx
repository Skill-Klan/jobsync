// Requirement — the owner, 2026-11-02: the study plan behind its own switch
// `plans`, off at launch, covering every menu item: «Навчальний план» for
// students and «Плани студентів» for whoever manages SkillKlan Job. Off, the
// pages are not there (404) and read nothing; the admin's page is not there for
// a student even when the switch is on; the phone menu shows what the side
// menu shows. Each "off" has its "on" pair, and another switch being off does
// not close these pages.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const flags = vi.hoisted(() => ({
  value: { automations: true, activities: true, library: true, plans: true, tasks: true, catalog: true },
}));
const admin = vi.hoisted(() => ({ value: true }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => admin.value) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: vi.fn(() => "/dashboard"),
}));
vi.mock("@/actions/plan.actions", () => ({
  getMyPlans: vi.fn(async () => ({ success: true, data: [] })),
  listPlanStudents: vi.fn(async () => ({ success: true, data: { students: [], tracks: [] } })),
}));
vi.mock("@/components/plans/PlanView", () => ({ default: () => <div data-testid="plan" /> }));
vi.mock("@/components/plans/StudentPlansAdmin", () => ({ default: () => <div data-testid="student-plans" /> }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));

import PlanPage from "@/app/dashboard/plan/page";
import StudentPlansPage from "@/app/dashboard/student-plans/page";
import Header from "@/components/Header";
import { getMyPlans, listPlanStudents } from "@/actions/plan.actions";

beforeEach(() => {
  flags.value = { automations: true, activities: true, library: true, plans: true, tasks: true, catalog: true };
  admin.value = true;
});

describe.each([
  ["the student's page", () => PlanPage(), "plan", getMyPlans],
  ["the admin's page", () => StudentPlansPage(), "student-plans", listPlanStudents],
] as const)("plans switch — %s", (_label, page, testId, read) => {
  it("off → not there (404), and its data is not read — the admin included", async () => {
    flags.value = { ...flags.value, plans: false };
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(read).not.toHaveBeenCalled();
  });

  it("on → the page, even with every other switch off", async () => {
    flags.value = { automations: false, activities: false, library: false, plans: true, tasks: true, catalog: true };
    render(await page());
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});

describe("the admin's page for a student", () => {
  it("the switch is on, the session is not an admin's → 404, nothing read", async () => {
    admin.value = false;
    await expect(StudentPlansPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listPlanStudents).not.toHaveBeenCalled();
  });
});

describe("the phone menu", () => {
  const open = async () => {
    render(await Header());
    await userEvent.setup().click(screen.getByRole("button", { name: "Toggle Menu" }));
  };

  it("on, a student → «Study plan» and no «Student plans»", async () => {
    admin.value = false;
    await open();
    expect(screen.getByRole("link", { name: "Study plan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Student plans" })).not.toBeInTheDocument();
  });

  it("on, the admin → both", async () => {
    await open();
    expect(screen.getByRole("link", { name: "Study plan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Student plans" })).toBeInTheDocument();
  });

  it("off, the admin → neither; the rest of the menu stays", async () => {
    flags.value = { ...flags.value, plans: false };
    await open();
    expect(screen.queryByRole("link", { name: "Study plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Student plans" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });
});
