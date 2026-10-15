// Requirement — D29: a job the automation found shows its workplace in
// Ukrainian (REMOTE → «Віддалено») in the list row and in the detail card,
// like the job pages do. A code the app doesn't know is shown as it came,
// not as "not specified" — it still says something about the job.
import { render, screen } from "@testing-library/react";
import { DiscoveredJobRow } from "@/components/automations/discovered-jobs-list/DiscoveredJobRow";
import { DiscoveredJobDetail } from "@/components/automations/DiscoveredJobDetail";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/automation.actions", () => ({}));

const job = (workplaceType: string) =>
  ({
    id: "d1",
    JobTitle: { label: "QA Engineer" },
    Company: { label: "Acme" },
    Location: { label: "Київ" },
    workplaceType,
    jobUrl: null,
    discoveryStatus: "new",
    discoveredAt: new Date("2026-10-01T09:00:00Z"),
    matchScore: null,
    matchData: null,
  }) as any;

const row = (workplaceType: string) =>
  render(
    <table>
      <tbody>
        <DiscoveredJobRow
          job={job(workplaceType)}
          isLoading={false}
          runInProgress={false}
          onAnalyze={vi.fn()}
          onAccept={vi.fn()}
          onDismiss={vi.fn()}
        />
      </tbody>
    </table>,
  );

beforeEach(() => setTestLocale("uk"));

describe("discovered job workplace, in Ukrainian", () => {
  it("list row", () => {
    row("REMOTE");
    expect(screen.getByText("Віддалено")).toBeInTheDocument();
    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
  });

  it("list row keeps an unknown code as it came", () => {
    row("FLEX");
    expect(screen.getByText("FLEX")).toBeInTheDocument();
    expect(screen.queryByText("Не вказано")).not.toBeInTheDocument();
  });

  it("detail card", () => {
    render(
      <DiscoveredJobDetail job={job("ONSITE")} matchData={null} open onOpenChange={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getByText("В офісі")).toBeInTheDocument();
  });
});
