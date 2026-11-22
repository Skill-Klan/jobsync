// Requirement — SKD-71 and the call budget (CLAUDE.md, docs/contracts/study-plans-mentors.md):
// the page of «Плани студентів» hands the filter the backend's list of mentors,
// asked once for the signed-in viewer (a shared answer, never per row); a list
// that was not answered reaches the page as «not loaded», and a viewer with no
// cabinet id asks nothing and gets no filter.
import { render } from "@testing-library/react";

const flags = vi.hoisted(() => ({ value: { plans: true } }));
vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => true) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/actions/plan.actions", () => ({
  listPlanStudents: vi.fn(async () => ({ success: true, data: { students: [], tracks: [] } })),
}));
const lookups = vi.hoisted(() => ({ viewerCabinetId: vi.fn(), loadMentors: vi.fn() }));
vi.mock("@/skillklan/mentorPlans", () => lookups);
const seen = vi.hoisted(() => ({ props: null as unknown }));
vi.mock("@/components/plans/StudentPlansAdmin", () => ({
  default: (props: unknown) => {
    seen.props = props;
    return null;
  },
}));

import StudentPlansPage from "@/app/dashboard/student-plans/page";

const mentors = [{ mentorId: 7, name: "Олена", direction: "Java" }];
const mentorsGiven = () => (seen.props as { mentors?: unknown }).mentors;

beforeEach(() => {
  seen.props = null;
  lookups.viewerCabinetId.mockReset().mockResolvedValue(1001);
  lookups.loadMentors.mockReset().mockResolvedValue(mentors);
});

describe("«Плани студентів» page — mentors for the filter", () => {
  it("the viewer's list of mentors goes to the page, asked once for that viewer", async () => {
    render(await StudentPlansPage());
    expect(mentorsGiven()).toEqual(mentors);
    expect(lookups.loadMentors).toHaveBeenCalledTimes(1);
    expect(lookups.loadMentors).toHaveBeenCalledWith(1001);
  });

  it("no answer from the backend → «not loaded» (null), not an empty list", async () => {
    lookups.loadMentors.mockResolvedValue(null);
    render(await StudentPlansPage());
    expect(mentorsGiven()).toBeNull();
  });

  it("a viewer with no cabinet id → nothing is asked, no filter", async () => {
    lookups.viewerCabinetId.mockResolvedValue(null);
    render(await StudentPlansPage());
    expect(mentorsGiven()).toBeUndefined();
    expect(lookups.loadMentors).not.toHaveBeenCalled();
  });
});
