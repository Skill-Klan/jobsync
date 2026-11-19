// Requirement — the owner, 2026-11-19 (SKD-52): the «Додати контакт» shortcut
// on the dashboard "out, maybe behind a feature switch" for the first release.
// With `contacts` off in Settings → «Функції»: no shortcut, and the sentence
// above the shortcuts stops naming contacts; the others stay. On (the pair):
// both are there. Contacts themselves are not touched — a job's contacts tab
// does not follow this switch. It is its own key: others off, contacts on →
// the shortcut is there.
import { render, screen } from "@testing-library/react";
import { FeaturesProvider } from "@/context/FeaturesContext";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { ALL_FEATURES_ON, type FeatureFlags } from "@/skillklan/features";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/actions/company.actions", () => ({ getAllCompanies: vi.fn(async () => []) }));
vi.mock("@/actions/jobLocation.actions", () => ({ getAllJobLocations: vi.fn(async () => []) }));
vi.mock("@/actions/contactRole.actions", () => ({ getAllContactRoles: vi.fn(async () => []) }));

const flags = (contacts: boolean, others = true): FeatureFlags => ({
  ...ALL_FEATURES_ON,
  automations: others,
  activities: others,
  tasks: others,
  questions: others,
  contacts,
});

describe.each([
  [false, 0],
  [true, 1],
])("contacts = %s", (on, shown) => {
  it(`«Add Contact»: ${shown} shown, and the sentence follows; the others stay`, () => {
    const { container } = render(<FeaturesProvider value={flags(on)}><JobsAppliedCard /></FeaturesProvider>);
    expect(screen.queryAllByRole("button", { name: /add contact/i })).toHaveLength(shown);
    expect(/contacts/i.test(container.textContent ?? "")).toBe(on);
    expect(screen.getByRole("button", { name: "Add Job" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Task" })).toBeInTheDocument();
  });
});

it("it is its own key: every other switch off, contacts on → the shortcut is there", () => {
  render(<FeaturesProvider value={flags(true, false)}><JobsAppliedCard /></FeaturesProvider>);
  expect(screen.getAllByRole("button", { name: /add contact/i })).toHaveLength(1);
});
