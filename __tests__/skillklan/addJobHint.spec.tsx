// Requirement — the owner, 2026-11-19 (SKD-53, meeting item 6): on the dashboard,
// hovering «Add Job» shows a hint saying what it is for; it also shows on keyboard
// focus. Nothing shows before that (paired absent/present).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ALL_FEATURES_ON } from "@/skillklan/features";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const HINT = /track its status, notes and contacts/i;
const setup = () => render(<FeaturesProvider value={ALL_FEATURES_ON}><JobsAppliedCard /></FeaturesProvider>);

it("no hint until the button is hovered", () => {
  setup();
  expect(screen.queryByText(HINT)).not.toBeInTheDocument();
});

it("hover shows the hint", async () => {
  setup();
  await userEvent.setup().hover(screen.getByRole("button", { name: "Add Job" }));
  expect((await screen.findAllByText(HINT)).length).toBeGreaterThan(0);
});

it("keyboard focus shows the hint", async () => {
  const user = userEvent.setup();
  setup();
  await user.tab();
  expect(screen.getByRole("button", { name: "Add Job" })).toHaveFocus();
  expect((await screen.findAllByText(HINT)).length).toBeGreaterThan(0);
});
