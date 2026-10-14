// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary): the
// Jobs area ("Вакансії") speaks Ukrainian — the list, the filters, the job
// page, its timeline, contacts, notes and cover letter. Stored statuses,
// stages, outcomes, roles and sources come from the `labels` dictionary, and
// dates put the day first with Ukrainian month names and 24-hour time.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyJobsTable from "@/components/myjobs/MyJobsTable";
import JobDetails from "@/components/myjobs/JobDetails";
import { JobTimelineTab } from "@/components/myjobs/job-details/timeline/JobTimelineTab";
import { JobContactsTab } from "@/components/myjobs/job-details/JobContactsTab";
import { CoverLetterTab } from "@/components/myjobs/job-details/CoverLetterTab";
import { NotesSection } from "@/components/myjobs/NotesSection";
import { JobsFilterPopover } from "@/components/myjobs/jobs-container/JobsFilterPopover";
import {
  formatStageDate,
  formatStageDateTime,
} from "@/components/myjobs/job-details/timeline/stageDisplay";
import { getJobFilterCounts } from "@/actions/job.actions";
import { getNotesByJobId } from "@/actions/note.actions";
import { EMPTY_JOB_FACETS } from "@/lib/jobs/jobFacets";
import type { JobResponse, JobStatus } from "@/models/job.model";
import { setTestLocale } from "../helpers/i18n";

const router = { back: vi.fn(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/myjobs/job-1",
}));

const chat = { busy: false, open: vi.fn(), clear: vi.fn(), sendMessage: vi.fn(), approvalPending: false };
vi.mock("@/components/agent/AgentChatProvider", () => ({ useAgentChat: () => chat }));
vi.mock("@/components/TipTapContentViewer", () => ({ TipTapContentViewer: () => null }));
vi.mock("@/components/automations/MatchDetails", () => ({ MatchDetails: () => null }));
vi.mock("@/components/profile/DownloadFileButton", () => ({ DownloadFileButton: () => null }));
vi.mock("@/components/CircularScore", () => ({
  CircularScore: ({ score }: { score: number }) => <div>{score}%</div>,
}));
vi.mock("@/actions/job.actions", () => ({
  getJobFilterCounts: vi.fn(),
  deleteJobById: vi.fn(),
  updateJobStatus: vi.fn(),
  addJob: vi.fn(),
  updateJob: vi.fn(),
  createLocation: vi.fn(),
  createJobSource: vi.fn(),
}));
vi.mock("@/actions/note.actions", () => ({
  getNotesByJobId: vi.fn(),
  addNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("@/actions/contact.actions", () => ({
  getAllContacts: vi.fn().mockResolvedValue([]),
  getJobContacts: vi.fn().mockResolvedValue([]),
  addJobContact: vi.fn(),
  removeJobContact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));
vi.mock("@/actions/contactRole.actions", () => ({
  getAllContactRoles: vi.fn().mockResolvedValue([]),
  createContactRole: vi.fn(),
}));
vi.mock("@/actions/jobStage.actions", () => ({
  getJobStages: vi.fn().mockResolvedValue([]),
  setPrepQuestionAsked: vi.fn(),
  removeStagePrepQuestion: vi.fn(),
  unlinkStageInterviewer: vi.fn(),
  setStageNotes: vi.fn(),
  deleteJobStage: vi.fn(),
  addJobStage: vi.fn(),
  updateJobStage: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn(),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const statuses: JobStatus[] = [
  { id: "s-applied", label: "Applied", value: "applied" },
  { id: "s-interview", label: "Interview", value: "interview" },
  { id: "s-rejected", label: "Rejected", value: "rejected" },
];

const makeJob = (over: Partial<JobResponse> = {}): JobResponse =>
  ({
    id: "job-1",
    userId: "user-1",
    JobTitle: { id: "t1", label: "Frontend Developer", value: "frontend developer" },
    Company: { id: "c1", label: "Acme Corp", value: "acme corp", logoUrl: "" },
    Status: { id: "s-applied", label: "Applied", value: "applied" },
    Location: { id: "l1", label: "Київ", value: "київ" },
    JobSource: { id: "src1", label: "Company Career page", value: "careerpage" },
    jobType: "FT",
    workplaceType: "REMOTE",
    createdAt: new Date(2025, 0, 1),
    appliedDate: new Date(2025, 0, 15),
    dueDate: new Date(2099, 0, 1),
    salaryRange: "",
    description: "",
    jobUrl: "",
    applied: true,
    tags: [],
    ...over,
  }) as JobResponse;

const stageType = (value: string, label: string, status: string) => ({
  id: `t-${value}`,
  label,
  value,
  statusId: `s-${status}`,
  sortOrder: 0,
  Status: { id: `s-${status}`, label: status, value: status },
});

const stage = (id: string, type: ReturnType<typeof stageType>, over: any = {}) => ({
  id,
  jobId: "job-1",
  stageTypeId: type.id,
  occurredAt: null,
  isCurrent: false,
  outcome: null,
  notes: null,
  durationMins: null,
  format: null,
  location: null,
  createdAt: new Date(2020, 8, 1),
  updatedAt: new Date(2020, 8, 1),
  StageType: type,
  interviewers: [],
  prepQuestions: [],
  ...over,
});

// Words the area used to show in English; none may be left on a Ukrainian screen.
const ENGLISH =
  /\b(Applied|Not Applied|Added|Title|Company|Location|Status|Match|Source|Full-time|Remote|Edit|Delete|Toggle menu|Jan|Description|Timeline|Cover Letter|Contacts|Notes|Job Type|Salary Range|Resume|Go Back|Not matched)\b/;

describe("jobs list in Ukrainian", () => {
  it("table headers, stored status and source, job type and dates", () => {
    setTestLocale("uk");
    const { container } = render(
      <MyJobsTable
        jobs={[makeJob()]}
        jobStatuses={statuses}
        deleteJob={vi.fn()}
        editJob={vi.fn()}
        onChangeJobStatus={vi.fn()}
        onAddNote={vi.fn()}
        sort={null}
        onSort={vi.fn()}
      />,
    );

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim()).filter(Boolean);
    expect(headers).toEqual(
      expect.arrayContaining(["Відгук", "Посада", "Компанія", "Локація", "Статус", "Відповідність", "Джерело"]),
    );
    expect(screen.getByText("Відгук надіслано")).toBeInTheDocument();
    expect(screen.getByText("Сайт компанії")).toBeInTheDocument();
    expect(screen.getByText("Повна зайнятість · Віддалено")).toBeInTheDocument();
    expect(screen.getByText("15 січ. 2025")).toBeInTheDocument();
    expect(screen.getByText("Додано 1 січ. 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Редагувати вакансію" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити вакансію" })).toBeInTheDocument();
    expect(screen.getByText("Перевірити")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("an expired draft and a dismissed discovered job read in Ukrainian", () => {
    setTestLocale("uk");
    render(
      <MyJobsTable
        jobs={[
          makeJob({ id: "j-exp", Status: { id: "s-d", label: "Draft", value: "draft" }, dueDate: new Date(2020, 0, 1) }),
          makeJob({ id: "j-dis", discoveryStatus: "dismissed" } as any),
        ]}
        jobStatuses={statuses}
        deleteJob={vi.fn()}
        editJob={vi.fn()}
        onChangeJobStatus={vi.fn()}
        onAddNote={vi.fn()}
        sort={null}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText("Неактуальна")).toBeInTheDocument();
    expect(screen.getByText("Відхилена")).toBeInTheDocument();
  });

  it("the filter popover: statuses, sections and the apply button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setTestLocale("uk");
      (getJobFilterCounts as any).mockResolvedValue({
        success: true,
        data: { total: 18, statusCounts: { "s-applied": 11 }, acceptedDiscovered: 7 },
      });
      const user = userEvent.setup({ delay: null });
      render(
        <JobsFilterPopover statuses={statuses} facets={EMPTY_JOB_FACETS} search="" scope={{}} onApply={vi.fn()} />,
      );
      await user.click(screen.getByRole("button", { name: "Фільтр вакансій" }));
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      const boxes = screen.getAllByRole("checkbox").map((b) => b.getAttribute("aria-label"));
      expect(boxes).toEqual([
        "Відгук надіслано",
        "Співбесіда",
        "Відмова",
        "Прийняті (з автопошуку)",
        "Показувати відхилені вакансії з автопошуку",
      ]);
      expect(screen.getByText("Тип зайнятості")).toBeInTheDocument();
      expect(screen.getByText("Формат роботи")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Повна зайнятість" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Віддалено" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Скинути все" })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Показати 18 вакансій" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("job page in Ukrainian", () => {
  beforeEach(() => {
    (getNotesByJobId as any).mockResolvedValue({ success: true, data: [] });
  });

  it("header, tabs and the summary card", async () => {
    setTestLocale("uk");
    const { container } = render(
      <JobDetails
        job={makeJob()}
        jobStatuses={statuses}
        companies={[]}
        titles={[]}
        locations={[]}
        sources={[]}
        tags={[]}
        stageTypes={[]}
      />,
    );
    await waitFor(() => expect(getNotesByJobId).toHaveBeenCalled());

    const tabs = screen.getAllByRole("tab").map((t) => t.textContent?.trim());
    expect(tabs).toEqual(["Опис", "Етапи", "Відповідність", "Супровідний лист", "Контакти", "Нотатки"]);
    expect(screen.getByRole("button", { name: "Перевірити відповідність" })).toBeInTheDocument();
    expect(screen.getByTestId("generate-cover-letter-btn")).toHaveTextContent("Супровідний лист");
    expect(screen.getByTitle("Назад")).toBeInTheDocument();
    for (const label of ["Статус", "Тип зайнятості", "Зарплата", "Джерело", "Резюме", "Додано"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Відгук надіслано")).toBeInTheDocument();
    expect(screen.getByText("Не перевірено")).toBeInTheDocument();
    expect(screen.getByText(/Київ · Повна зайнятість · Віддалено/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("notes: the heading, the add button and an empty list", async () => {
    setTestLocale("uk");
    render(<NotesSection jobId="job-1" />);
    expect(await screen.findByText("Нотаток ще немає.")).toBeInTheDocument();
    expect(screen.getByText("Нотатки")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати нотатку" })).toBeInTheDocument();
  });

  it("a note shows its date the Ukrainian way and says it was edited", async () => {
    setTestLocale("uk");
    (getNotesByJobId as any).mockResolvedValue({
      success: true,
      data: [{ id: "n1", jobId: "job-1", content: "<p>x</p>", createdAt: new Date(2026, 9, 2, 14, 30), isEdited: true }],
    });
    render(<NotesSection jobId="job-1" />);
    expect(await screen.findByText(/2 жовт\. 2026, 14:30/)).toBeInTheDocument();
    expect(screen.getByText("(змінено)")).toBeInTheDocument();
    expect(screen.getByText("1 нотатка до вакансії")).toBeInTheDocument();
  });
});

describe("timeline in Ukrainian", () => {
  const applied = stageType("applied", "Applied", "applied");
  const technical = stageType("2nd technical interview", "2nd Technical Interview", "interview");
  const offer = stageType("offer", "Offer", "offer");

  it("stage history, the selected stage and its details", () => {
    setTestLocale("uk");
    const stages = [
      stage("a", applied, { occurredAt: new Date(2020, 8, 3) }),
      stage("b", technical, {
        occurredAt: new Date(2020, 8, 24, 10, 0),
        isCurrent: true,
        outcome: "passed",
        durationMins: 90,
      }),
    ] as any;
    const { container } = render(
      <JobTimelineTab
        stages={stages}
        stageTypes={[applied, technical, offer] as any}
        selectedStageId="b"
        currentStageId="b"
        onSelect={vi.fn()}
        onAddStage={vi.fn()}
        onEditStage={vi.fn()}
        onLinkInterviewers={vi.fn()}
        onAddPrepQuestions={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "ІСТОРІЯ ЕТАПІВ" })).toBeInTheDocument();
    expect(screen.getByText("Відгук надіслано")).toBeInTheDocument();
    expect(screen.getAllByText("Технічна співбесіда").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Офер")).toBeInTheDocument();
    expect(screen.getByText("3 верес.")).toBeInTheDocument();
    expect(screen.getByText("ПОТОЧНИЙ ЕТАП")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent?.trim())).toEqual(["Огляд", "Інтервʼюери", "Підготовка"]);
    expect(screen.getByText("Пройдено")).toBeInTheDocument();
    expect(screen.getByText("24 верес. 2020 · 10:00 · 90 хв")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати етап" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /\b(STAGE HISTORY|Add stage|CURRENT STAGE|Overview|Interviewer|Prep List|OUTCOME|Passed|NOTES|min|Sep|AM|PM)\b/,
    );
  });

  it("stage dates: no date, a past date and an upcoming one", () => {
    setTestLocale("uk");
    expect(formatStageDate(null, "uk")).toBe("—");
    expect(formatStageDate(new Date(2026, 8, 24), "uk")).toBe("24 верес.");
    expect(formatStageDateTime(null, null, "uk")).toBe("Дату не вказано");
    expect(formatStageDateTime(new Date(2020, 8, 24, 15, 5), null, "uk")).toBe("24 верес. 2020 · 15:05");
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(formatStageDateTime(future, 45, "uk")).toMatch(/^Заплановано на .* · 45 хв$/);
  });
});

describe("empty tabs and contacts in Ukrainian", () => {
  it("timeline, cover letter and contacts say what to do next", () => {
    setTestLocale("uk");
    render(
      <>
        <JobTimelineTab
          stages={[]}
          stageTypes={[]}
          selectedStageId={null}
          currentStageId={null}
          onSelect={vi.fn()}
          onAddStage={vi.fn()}
          onEditStage={vi.fn()}
          onLinkInterviewers={vi.fn()}
          onAddPrepQuestions={vi.fn()}
          onChanged={vi.fn()}
        />
        <CoverLetterTab onGenerate={vi.fn()} />
        <JobContactsTab jobId="job-1" links={[]} onLinksChange={vi.fn()} />
      </>,
    );
    expect(screen.getByText("Етапів ще немає")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати етап" })).toBeInTheDocument();
    expect(screen.getByText("Супровідного листа ще немає")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити супровідний лист" })).toBeInTheDocument();
    expect(screen.getByText("До вакансії не додано контактів")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати контакт" })).toBeInTheDocument();
  });

  it("a linked contact shows its stored role and last contact date in Ukrainian", () => {
    setTestLocale("uk");
    const link = {
      id: "jc1",
      jobId: "job-1",
      contactId: "c1",
      roleId: "r1",
      createdAt: new Date(),
      Role: { id: "r1", label: "Recruiter", value: "recruiter" },
      Contact: { id: "c1", name: "Олена Коваль", title: null, email: null, phone: null, linkedinUrl: null, lastContactedAt: new Date(2026, 9, 2), Company: null },
    } as any;
    render(<JobContactsTab jobId="job-1" links={[link]} onLinksChange={vi.fn()} />);
    const row = screen.getByText("Олена Коваль").closest("li")!;
    expect(within(row).getByText("Рекрутер")).toBeInTheDocument();
    expect(within(row).getByText("Останній контакт: 2 жовт. 2026")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Прибрати: Олена Коваль" })).toBeInTheDocument();
  });
});
