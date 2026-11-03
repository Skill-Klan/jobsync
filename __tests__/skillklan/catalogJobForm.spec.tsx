// Requirement — product notes, 2026-11-03: with the switch `catalog` on, the
// job form offers the shared list and nothing else:
//   · a picker lists the catalog's entries only — the person's own extras are
//     not offered (a job saved with one keeps showing it);
//   · picking an entry the person has not used yet makes their own row first
//     (pickCatalogItem), and the form holds that row;
//   · typing something the list lacks offers «Suggest …» — it sends a request to
//     the administrator and creates nothing;
//   · skills work the same way;
//   · with the switch off, or no catalog provided, the form is what it was.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddJob } from "@/components/myjobs/AddJob";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { ALL_FEATURES_ON } from "@/skillklan/features";
import { JOB_STATUSES } from "@/lib/data/jobStatusesData";
import { MOCK_JOB_SOURCES } from "../fixtures/mockJobSources";
import { addJob } from "@/actions/job.actions";
import { createJobTitle } from "@/actions/jobtitle.actions";
import { createTag } from "@/actions/tag.actions";
import { pickCatalogItem, requestCatalogItem } from "@/actions/catalog.actions";
import { toastSuccess } from "@/lib/toast";
import type { JobResponse } from "@/models/job.model";
import type { CatalogEntryView } from "@/skillklan/catalog/kinds";

vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/actions/job.actions", () => ({
  addJob: vi.fn().mockResolvedValue({ success: true }),
  updateJob: vi.fn().mockResolvedValue({ success: true }),
  createLocation: vi.fn(),
  createJobSource: vi.fn(),
}));
vi.mock("@/actions/jobtitle.actions", () => ({ createJobTitle: vi.fn() }));
vi.mock("@/actions/company.actions", () => ({ addCompany: vi.fn() }));
vi.mock("@/actions/tag.actions", () => ({ createTag: vi.fn() }));
vi.mock("@/actions/profile.actions", () => ({ getResumeList: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock("@/actions/coverLetter.actions", () => ({ getCoverLetterList: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock("@/actions/note.actions", () => ({
  getNotesByJobId: vi.fn().mockResolvedValue({ success: true, data: [] }),
  addNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("@/actions/catalog.actions", () => ({
  pickCatalogItem: vi.fn(),
  requestCatalogItem: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastActionResult: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.createRange = () => {
  const range = new Range();
  range.getBoundingClientRect = vi.fn().mockReturnValue({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 });
  range.getClientRects = () => ({ item: () => null, length: 0, [Symbol.iterator]: vi.fn() }) as never;
  return range;
};
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

const own = (id: string, label: string) => ({ id, label, value: label.toLowerCase() });
const titles = [own("t-own-qa", "QA Engineer"), own("t-own-odd", "Ninja Tester")]; // the person's own
const companies = [own("c-own-acme", "Acme"), own("c-own-odd", "My Garage Ltd")];
const locations = [own("l-own-kyiv", "Kyiv")];
const tags = [own("g-own-java", "java"), own("g-own-odd", "pisʹ")];

const catalog: CatalogEntryView[] = [
  { id: "e-t1", kind: "jobTitle", label: "QA Engineer", value: "qa engineer" },
  { id: "e-t2", kind: "jobTitle", label: "Automation QA", value: "automation qa" },
  { id: "e-c1", kind: "company", label: "Acme", value: "acme" },
  { id: "e-c2", kind: "company", label: "Globex", value: "globex" },
  { id: "e-l1", kind: "location", label: "Kyiv", value: "kyiv" },
  { id: "e-s1", kind: "skill", label: "Java", value: "java" },
  { id: "e-s2", kind: "skill", label: "Selenium", value: "selenium" },
  { id: "e-j1", kind: "jobSource", label: "DOU", value: "dou" },
];

function renderForm({ catalogOn = true, editJob = null as JobResponse | null, provide = true } = {}) {
  const form = (
    <AddJob
      jobStatuses={JOB_STATUSES}
      companies={companies as never}
      jobTitles={titles as never}
      locations={locations as never}
      jobSources={MOCK_JOB_SOURCES}
      tags={tags as never}
      editJob={editJob}
      resetEditJob={vi.fn()}
      initialOpen
    />
  );
  return render(
    <FeaturesProvider value={{ ...ALL_FEATURES_ON, catalog: catalogOn }}>
      <CatalogProvider value={provide ? catalog : null}>{form}</CatalogProvider>
    </FeaturesProvider>,
  );
}

const user = () => userEvent.setup({ skipHover: true });
const optionsOf = () => screen.getAllByRole("option").map((o) => o.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pickCatalogItem).mockResolvedValue({ success: true, data: { id: "t-new", label: "Automation QA", value: "automation qa" } });
  vi.mocked(requestCatalogItem).mockResolvedValue({ success: true, data: { again: false } });
});

describe("the pickers with the catalog on", () => {
  it("list the catalog only; the person's own extras are not offered", async () => {
    renderForm();
    await user().click(await screen.findByLabelText("Job Title"));
    expect(optionsOf()).toEqual(["Automation QA", "QA Engineer"]);
    expect(screen.queryByText("Ninja Tester")).not.toBeInTheDocument();
  });

  it("the same for companies", async () => {
    renderForm();
    await user().click(await screen.findByLabelText("Company"));
    expect(optionsOf()).toEqual(["Acme", "Globex"]);
  });

  it("an entry the person has not used makes their own row first, then the form holds it", async () => {
    renderForm();
    const u = user();
    await u.click(await screen.findByLabelText("Job Title"));
    await u.click(screen.getByRole("option", { name: "Automation QA" }));

    expect(pickCatalogItem).toHaveBeenCalledWith("e-t2");
    await waitFor(() => expect(screen.getByLabelText("Job Title")).toHaveTextContent("Automation QA"));
  });

  it("an entry the person already has needs no call: it is their own row", async () => {
    renderForm();
    const u = user();
    await u.click(await screen.findByLabelText("Job Title"));
    await u.click(screen.getByRole("option", { name: "QA Engineer" }));
    expect(pickCatalogItem).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Job Title")).toHaveTextContent("QA Engineer");
  });

  it("typing what the list lacks offers a suggestion — it sends a request and creates nothing", async () => {
    renderForm();
    const u = user();
    await u.click(await screen.findByLabelText("Job Title"));
    await u.type(screen.getByPlaceholderText(/Search/i), "Rust Wizard");

    expect(screen.queryByText("Create:")).not.toBeInTheDocument();
    await u.click(screen.getByText("Suggest “Rust Wizard”"));

    expect(requestCatalogItem).toHaveBeenCalledWith("jobTitle", "Rust Wizard");
    expect(createJobTitle).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sent. The administrator will look at it."));
  });

  it("Enter on a typed name suggests it too", async () => {
    renderForm();
    const u = user();
    await u.click(await screen.findByLabelText("Company"));
    await u.type(screen.getByPlaceholderText(/Search/i), "Initech{Enter}");
    expect(requestCatalogItem).toHaveBeenCalledWith("company", "Initech");
  });

  it("asking twice says so; a refusal is shown, not hidden", async () => {
    vi.mocked(requestCatalogItem).mockResolvedValueOnce({ success: true, data: { again: true } });
    renderForm();
    const u = user();
    await u.click(await screen.findByLabelText("Job Title"));
    await u.type(screen.getByPlaceholderText(/Search/i), "Rust Wizard{Enter}");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("You have already suggested this."));
  });

  it("a job saved with something outside the catalog keeps showing it", async () => {
    const editJob = {
      id: "job-1",
      userId: "u1",
      JobTitle: { id: "t-own-odd", label: "Ninja Tester", value: "ninja tester" },
      Company: { id: "c-own-acme", label: "Acme", value: "acme", logoUrl: "" },
      Location: { id: "l-own-kyiv", label: "Kyiv", value: "kyiv" },
      JobSource: { id: MOCK_JOB_SOURCES[0].id, label: MOCK_JOB_SOURCES[0].label, value: MOCK_JOB_SOURCES[0].value },
      Status: { id: JOB_STATUSES[0].id, label: JOB_STATUSES[0].label, value: JOB_STATUSES[0].value },
      jobType: "FT",
      createdAt: new Date("2026-10-01"),
      dueDate: new Date("2026-10-20"),
      description: "<p>Existing job description</p>",
      applied: false,
      tags: [{ id: "g-own-odd", label: "pisʹ", value: "pisʹ" }],
    } as unknown as JobResponse;
    renderForm({ editJob });
    expect(await screen.findByLabelText("Job Title")).toHaveTextContent("Ninja Tester");
    expect(screen.getByText("pisʹ")).toBeInTheDocument();
  });
});

describe("skills with the catalog on", () => {
  const openSkills = async () => {
    const u = user();
    await u.click(await screen.findByRole("combobox", { name: /skill/i }));
    return u;
  };

  it("list the catalog's skills only", async () => {
    renderForm();
    await openSkills();
    expect(optionsOf()).toEqual(["Java", "Selenium"]);
    expect(screen.queryByText("pisʹ")).not.toBeInTheDocument();
  });

  it("picking one the person has not used makes their own tag, and a chip appears", async () => {
    vi.mocked(pickCatalogItem).mockResolvedValue({ success: true, data: { id: "g-new", label: "Selenium", value: "selenium" } });
    renderForm();
    const u = await openSkills();
    await u.click(screen.getByRole("option", { name: "Selenium" }));

    expect(pickCatalogItem).toHaveBeenCalledWith("e-s2");
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove Selenium/i })).toBeInTheDocument());
  });

  it("typing a skill the list lacks suggests it and creates no tag", async () => {
    renderForm();
    const u = await openSkills();
    await u.type(screen.getByPlaceholderText(/skill/i), "Rust");
    await u.click(screen.getByText("Suggest “Rust”"));
    expect(requestCatalogItem).toHaveBeenCalledWith("skill", "Rust");
    expect(createTag).not.toHaveBeenCalled();
  });
});

describe("with the catalog off — the form is what it was", () => {
  it("the switch is off: the person's own lists are offered, and a new name is created", async () => {
    renderForm({ catalogOn: false });
    const u = user();
    await u.click(await screen.findByLabelText("Job Title"));
    expect(optionsOf()).toEqual(["QA Engineer", "Ninja Tester"]);
    await u.type(screen.getByPlaceholderText(/Search|Create/i), "Rust Wizard");
    expect(screen.getByText("Create:")).toBeInTheDocument();
    expect(screen.queryByText(/Suggest/)).not.toBeInTheDocument();
  });

  it("the switch is on but no catalog was provided: the same", async () => {
    renderForm({ provide: false });
    await user().click(await screen.findByLabelText("Company"));
    expect(optionsOf()).toEqual(["Acme", "My Garage Ltd"]);
  });
});
