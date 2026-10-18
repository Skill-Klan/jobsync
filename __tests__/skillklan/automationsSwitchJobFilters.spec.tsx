// Requirement — the owner, 2026-10-18 (D73): Automations hidden "on the same
// principle" as Activities — nothing of it left on screen. The Jobs filters
// carry two pieces of it: the "accepted (discovered)" status and "include
// dismissed discovered jobs". With Automations off both are gone, and "Select
// all" does not switch the hidden one on behind the person's back. Pair: on,
// both are there and "Select all" includes "accepted" as before.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsFilterPopover } from "@/components/myjobs/jobs-container/JobsFilterPopover";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { getJobFilterCounts } from "@/actions/job.actions";
import { EMPTY_JOB_FACETS } from "@/lib/jobs/jobFacets";

vi.mock("@/actions/job.actions", () => ({ getJobFilterCounts: vi.fn() }));

const statuses = [
  { id: "s-applied", label: "Applied", value: "applied" },
  { id: "s-interview", label: "Interview", value: "interview" },
];

describe.each([
  [false, "off"],
  [true, "on (pair)"],
])("Automations %s", (automations) => {
  const user = userEvent.setup({ delay: null });
  const onApply = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getJobFilterCounts).mockResolvedValue({
      success: true,
      data: { total: 2, statusCounts: {}, acceptedDiscovered: 1 },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  const openPopover = async () => {
    render(
      <FeaturesProvider value={{ automations, activities: true, library: true }}>
        <JobsFilterPopover statuses={statuses} facets={EMPTY_JOB_FACETS} search="" scope={{}} onApply={onApply} />
      </FeaturesProvider>,
    );
    await user.click(screen.getByRole("button", { name: /^Filter jobs/ }));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  };

  it("the two discovered-job filters follow the switch; the statuses stay", async () => {
    await openPopover();
    for (const name of ["Accepted (discovered)", "Include dismissed discovered jobs"]) {
      const box = screen.queryByRole("checkbox", { name });
      if (automations) expect(box).toBeInTheDocument();
      else expect(box).not.toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "Applied" })).toBeInTheDocument();
  });

  it("Select all picks every status shown — and 'accepted' only when it is shown", async () => {
    await openPopover();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    // Everything shown is picked: the same button now offers to clear.
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Show/ }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ["applied", "interview"],
        acceptedDiscovered: automations,
      }),
    );
  });
});
