// Requirement — the owner, 2026-11-19 (SKD-65, follow-up of SKD-53): the dashboard
// also offers useful ways in, not only «create» buttons: a «Go to» row with
// Interviews, Job bank and Study plan, each a real link with a hint on hover and
// keyboard focus. The study plan follows the `plans` switch (off → no link);
// the other two have no switch.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ALL_FEATURES_ON } from "@/skillklan/features";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const setup = (plans: boolean) =>
  render(<FeaturesProvider value={{ ...ALL_FEATURES_ON, plans }}><JobsAppliedCard /></FeaturesProvider>);

it("the Go to row links to Interviews, Job bank and Study plan", () => {
  setup(true);
  expect(screen.getByText("Go to")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Interviews" })).toHaveAttribute("href", "/dashboard/interviews");
  expect(screen.getByRole("link", { name: "Job bank" })).toHaveAttribute("href", "/dashboard/myjobs");
  expect(screen.getByRole("link", { name: "Study plan" })).toHaveAttribute("href", "/dashboard/plan");
});

it("plans off: no Study plan link, the other two stay", () => {
  setup(false);
  expect(screen.queryByRole("link", { name: "Study plan" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Interviews" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Job bank" })).toBeInTheDocument();
});

it.each([
  ["Interviews", /upcoming and past interviews/i],
  ["Job bank", /every job you have saved/i],
  ["Study plan", /tick off what you have done/i],
])("%s: no hint until focused, then the hint shows", async (name, hint) => {
  const user = userEvent.setup();
  setup(true);
  expect(screen.queryByText(hint)).not.toBeInTheDocument();
  await user.hover(screen.getByRole("link", { name }));
  expect((await screen.findAllByText(hint)).length).toBeGreaterThan(0);
});
