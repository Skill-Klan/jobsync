// Requirement — the owner, 2026-10-18. Browser side of two more switches:
//   · D73 Automations off: no Automations item in the side menu, no "Add
//     Automation" quick action and no word "automations" above the quick
//     actions; D75 notifications go with it — no Notifications item in the
//     user menu, and the summary of unread ones is not even requested;
//   · D73 the Library off: no Library item in the side menu; D76 the company
//     name in a job card, the jobs table and a job's header is plain text,
//     not a link to the (now closed) company page.
// Each "off" has its "on" pair; the switch under test moves alone.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { JobCard } from "@/components/myjobs/JobCard";
import MyJobsTable from "@/components/myjobs/MyJobsTable";
import { JobDetailsHeader } from "@/components/myjobs/job-details/JobDetailsHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { NotificationProvider, useNotifications } from "@/context/NotificationContext";
import { getNotificationSummary } from "@/actions/notification.actions";
import type { FeatureFlags } from "@/skillklan/features";
import type { JobResponse, JobStatus } from "@/models/job.model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/actions/notification.actions", () => ({ getNotificationSummary: vi.fn() }));
vi.mock("@/context/ActivityContext", () => ({
  useActivity: () => ({ currentActivity: undefined, startActivity: vi.fn() }),
}));
vi.mock("@/components/agent/AgentChatProvider", () => ({ useAgentChat: () => ({ busy: false }) }));

const ALL_ON: FeatureFlags = { automations: true, activities: true, library: true };
const withFeatures = (features: FeatureFlags, ui: React.ReactNode) =>
  render(<FeaturesProvider value={features}>{ui}</FeaturesProvider>);

beforeEach(() => {
  vi.mocked(getNotificationSummary).mockResolvedValue({
    success: true,
    data: { unread: 3, unreadErrors: 0 },
  } as never);
});

describe.each([
  [false, "off"],
  [true, "on (pair)"],
])("Automations %s", (automations) => {
  const features = { ...ALL_ON, automations };
  const expectPresence = (el: HTMLElement | null) =>
    automations ? expect(el).toBeInTheDocument() : expect(el).not.toBeInTheDocument();

  const renderSidebar = () =>
    withFeatures(
      features,
      <NotificationProvider>
        <SidebarProvider initialExpanded>
          <Sidebar user={{ id: "1", name: "A", email: "a@example.invalid" }} signOutAction={() => {}} />
        </SidebarProvider>
      </NotificationProvider>,
    );

  it("side menu: the Automations item follows the switch, the rest stay", () => {
    renderSidebar();
    expectPresence(screen.queryByRole("link", { name: "Automations" }));
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Library" })).toBeInTheDocument();
  });

  it("user menu: Notifications follows the switch, Settings stays", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "User menu" }));
    expect(await screen.findByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expectPresence(screen.queryByRole("menuitem", { name: /Notifications/ }));
  });

  it("the unread summary is requested only while Automations is on", async () => {
    function Probe() {
      return <span>unread:{useNotifications().summary.unread}</span>;
    }
    withFeatures(features, <NotificationProvider><Probe /></NotificationProvider>);
    if (automations) {
      expect(await screen.findByText("unread:3")).toBeInTheDocument();
    } else {
      // Give the mount effect its turn; nothing must have been asked.
      await waitFor(() => expect(screen.getByText("unread:0")).toBeInTheDocument());
      expect(getNotificationSummary).not.toHaveBeenCalled();
    }
  });

  it.each([true, false])(
    "dashboard quick actions (Activities %s): Add Automation and the word follow the switch",
    (activities) => {
      const { container } = withFeatures({ ...features, activities }, <JobsAppliedCard />);
      expectPresence(screen.queryByRole("button", { name: "Add Automation" }));
      expect(screen.getByRole("button", { name: "Add Task" })).toBeInTheDocument();
      const description = container.querySelector("p")?.textContent ?? "";
      if (automations) expect(description).toMatch(/automations/);
      else expect(description).not.toMatch(/automation/i);
      // The other switch keeps its own word.
      if (activities) expect(description).toMatch(/activities/);
      else expect(description).not.toMatch(/activit/i);
    },
  );
});

const statuses: JobStatus[] = [{ id: "1", label: "Applied", value: "applied" }];
const job = {
  id: "job-1",
  userId: "user-1",
  JobTitle: { id: "1", label: "QA Engineer", value: "qa engineer" },
  Company: { id: "c-1", label: "Acme Corp", value: "acme corp", logoUrl: "" },
  Status: { id: "1", label: "Applied", value: "applied" },
  Location: { id: "1", label: "Kyiv", value: "kyiv" },
  JobSource: { id: "1", label: "Djinni", value: "djinni" },
  jobType: "FT",
  createdAt: new Date(2026, 9, 1),
  appliedDate: new Date(2026, 9, 1),
  dueDate: new Date("2099-01-01"),
  salaryRange: "",
  description: "",
  jobUrl: "",
  applied: true,
} as unknown as JobResponse;

describe.each([
  [false, "off"],
  [true, "on (pair)"],
])("the Library %s — the company name", (library) => {
  const features = { ...ALL_ON, library };
  const expectCompany = () => {
    const link = screen.queryByRole("link", { name: "Acme Corp" });
    if (library) {
      expect(link).toHaveAttribute("href", "/dashboard/admin/companies/c-1");
    } else {
      expect(link).not.toBeInTheDocument();
      // Still named — in a job's header it shares a line with the location.
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    }
  };

  it("side menu: the Library item follows the switch", () => {
    withFeatures(
      features,
      <SidebarProvider initialExpanded>
        <Sidebar user={{ id: "1", name: "A", email: "a@example.invalid" }} signOutAction={() => {}} />
      </SidebarProvider>,
    );
    const item = screen.queryByRole("link", { name: "Library" });
    if (library) expect(item).toBeInTheDocument();
    else expect(item).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Automations" })).toBeInTheDocument();
  });

  it("job card", () => {
    withFeatures(
      features,
      <JobCard
        job={job}
        jobStatuses={statuses}
        editJob={vi.fn()}
        onChangeJobStatus={vi.fn()}
        onAddNote={vi.fn()}
        onDeleteJob={vi.fn()}
      />,
    );
    expectCompany();
  });

  it("jobs table", () => {
    withFeatures(
      features,
      <MyJobsTable
        jobs={[job]}
        jobStatuses={statuses}
        deleteJob={vi.fn()}
        editJob={vi.fn()}
        onChangeJobStatus={vi.fn()}
        onAddNote={vi.fn()}
        sort={null}
        onSort={vi.fn()}
      />,
    );
    expectCompany();
  });

  it("a job's header", () => {
    withFeatures(
      features,
      <JobDetailsHeader
        job={job}
        chatBusy={false}
        onBack={vi.fn()}
        onMatch={vi.fn()}
        onCoverLetter={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddNote={vi.fn()}
      />,
    );
    expectCompany();
  });
});
