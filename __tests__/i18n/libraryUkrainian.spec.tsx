// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary): the
// Library ("Довідники") speaks Ukrainian — tab names, headings, buttons, table
// headers, empty states. Seeded statuses, stages, roles and sources come from
// the labels dictionary by their value; dates are day-first in Ukrainian.
import { render, screen, within } from "@testing-library/react";
import AdminPage from "@/app/dashboard/admin/page";
import CompanyDetails from "@/components/admin/CompanyDetails";
import ContactsTable from "@/components/admin/ContactsTable";
import JobStagesContainer from "@/components/admin/JobStagesContainer";
import { getCompanyList } from "@/actions/company.actions";
import { getJobStageTypeList } from "@/actions/jobStageType.actions";
import { setTestLocale } from "../helpers/i18n";

let searchParams = new URLSearchParams();
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/dashboard/admin",
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/actions/company.actions", () => ({
  getCompanyList: vi.fn(),
  getCompanyById: vi.fn(),
  getAllCompanies: vi.fn().mockResolvedValue([]),
  addCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompanyById: vi.fn(),
  setCompanyWatched: vi.fn(),
  watchBoardCompany: vi.fn(),
  getWatchedBoards: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/actions/atsCompany.actions", () => ({
  searchAtsCompanies: vi.fn().mockResolvedValue({ companies: [], hasMore: false }),
  getAtsCompanyCount: vi.fn().mockResolvedValue(0),
  resolveAtsBoard: vi.fn(),
}));

vi.mock("@/actions/jobtitle.actions", () => ({
  getJobTitleList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}));

vi.mock("@/actions/jobLocation.actions", () => ({
  getJobLocationsList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAllJobLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/actions/contact.actions", () => ({
  getContactList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getContactById: vi.fn(),
  deleteContactById: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/actions/activity.actions", () => ({
  getActivityTypeList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createActivityType: vi.fn(),
}));

vi.mock("@/actions/contactRole.actions", () => ({
  getContactRoleList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAllContactRoles: vi.fn().mockResolvedValue([]),
  createContactRole: vi.fn(),
  deleteContactRoleById: vi.fn(),
}));

vi.mock("@/actions/jobStageType.actions", () => ({
  getJobStageTypeList: vi.fn(),
  createJobStageType: vi.fn(),
  updateJobStageType: vi.fn(),
  deleteJobStageTypeById: vi.fn(),
}));

vi.mock("@/actions/job.actions", () => ({
  getStatusList: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn(),
}));

vi.mock("@/components/CircularScore", () => ({
  CircularScore: ({ score }: { score: number }) => <div>{score}%</div>,
}));

// Words each screen had in English. Shared widgets outside the Library
// (record counter, delete dialog) are not checked here.
const ENGLISH =
  /\b(Library|Companies|Company Name|New Company|My Companies|Total Jobs|Jobs Applied|Rejected|Contacts|Actions|Watch|Unwatch|Edit|Delete|Jobs|Applied|Not watched|Watchlist|Industry|Website|Notes|No contacts|Add Contact|Name|Title|Roles|Last contacted|Job Stages|New Stage|Stage|Parent Status|Order|Recruiter|Interview|Final|Company Career page)\b/;

const company = {
  id: "co1",
  label: "Monobank",
  value: "monobank",
  createdBy: "u1",
  _count: { jobsTotal: 3, jobsApplied: 2, jobsRejected: 1, contacts: 1 },
};

const details = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "co1",
    label: "Monobank",
    value: "monobank",
    createdBy: "u1",
    watched: false,
    watchedAt: null,
    atsProvider: null,
    atsToken: null,
    atsHost: null,
    websiteUrl: null,
    careersUrl: null,
    industry: null,
    linkedinUrl: null,
    size: null,
    notes: "Сильна команда",
    jobs: [
      {
        id: "j1",
        createdAt: new Date(2026, 8, 1),
        applied: true,
        appliedDate: new Date(2026, 8, 2),
        matchScore: null,
        JobTitle: { label: "QA Engineer" },
        Status: { label: "Applied", value: "applied" },
        Location: { label: "Київ" },
        JobSource: { label: "Company Career page", value: "careerpage" },
      },
    ],
    appliedCount: 1,
    dismissedJobsCount: 0,
    currentContacts: [],
    formerContacts: [],
    ...overrides,
  }) as any;

const contact = {
  id: "c1",
  name: "Олена Коваль",
  title: "HR",
  email: null,
  phone: null,
  linkedinUrl: null,
  companyId: "co1",
  Company: { id: "co1", label: "Monobank" },
  locationId: null,
  Location: null,
  relationship: null,
  workedAtCompanyId: null,
  WorkedAtCompany: null,
  workedFrom: null,
  workedTo: null,
  roleId: "r1",
  Role: { id: "r1", label: "Recruiter", value: "recruiter", createdBy: "u1" },
  notes: null,
  lastContactedAt: new Date(2026, 9, 14),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "u1",
  jobLinks: [],
  _count: { jobLinks: 0 },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  setTestLocale("uk");
});

describe("Library page in Ukrainian", () => {
  it("heading, the nine tabs and the Companies tab use the agreed words", async () => {
    (getCompanyList as any).mockResolvedValue({ data: [company], total: 1 });
    render(await AdminPage());

    expect(screen.getByRole("heading", { name: "Довідники" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Компанії", "Посади", "Локації", "Джерела", "Навички", "Типи активностей", "Контакти", "Ролі", "Етапи",
    ]);

    const panel = screen.getByRole("tabpanel");
    await within(panel).findByText("Monobank");
    expect(within(panel).getByRole("heading", { name: "Компанії" })).toBeInTheDocument();
    expect(within(panel).getByPlaceholderText("Пошук компаній…")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Нова компанія" })).toBeInTheDocument();
    expect(within(panel).getByRole("combobox", { name: "Які компанії показувати" })).toHaveTextContent("Мої компанії");
    expect(within(panel).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Логотип компанії", "Назва компанії", "Значення", "Усього вакансій", "З відгуком", "Відмови", "Контакти", "Дії", "Дії",
    ]);
    expect(within(panel).getByRole("button", { name: "Відкрити меню" })).toBeInTheDocument();
    expect(panel.textContent).not.toMatch(ENGLISH);
  });
});

describe("company page in Ukrainian", () => {
  it("header, summary and jobs: buttons, facts, a stored status and source, the date day-first", () => {
    render(<CompanyDetails details={details()} />);

    for (const name of ["Відстежувати", "Редагувати", "Видалити"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Назад до компаній" })).toBeInTheDocument();

    const summary = screen.getByTestId("company-summary");
    expect(within(summary).getByText("Відстеження").nextElementSibling).toHaveTextContent("Не відстежується");
    expect(within(summary).getByText("Галузь")).toBeInTheDocument();
    expect(within(summary).getByText("Сторінка вакансій")).toBeInTheDocument();
    expect(within(summary).getByText("Нотатки")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /Вакансії/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Контакти/ })).toBeInTheDocument();

    const row = screen.getByRole("row", { name: /QA Engineer/ });
    expect(within(row).getByText("Відгук надіслано")).toBeInTheDocument();
    expect(within(row).getByText("2 верес. 2026")).toBeInTheDocument();
    expect(within(row).getByText("Сайт компанії")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Посада", "Статус", "Локація", "Відгук", "Відповідність", "Джерело",
    ]);

    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it("contacts tab, empty: says so and offers to add one", () => {
    searchParams = new URLSearchParams("tab=contacts");
    render(<CompanyDetails details={details({ jobs: [] })} />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("У цій компанії ще немає контактів")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Додати контакт" })).toBeInTheDocument();
    expect(panel.textContent).not.toMatch(ENGLISH);
  });
});

describe("contacts table in Ukrainian", () => {
  it("headers, a seeded role by the glossary, the last contact date day-first", () => {
    render(<ContactsTable contacts={[contact]} reloadContacts={vi.fn()} editContact={vi.fn()} />);

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Розгорнути", "Імʼя", "Посада", "Компанія", "Ролі", "Вакансії", "Останній контакт", "Дії",
    ]);
    expect(screen.getByText("Рекрутер")).toBeInTheDocument();
    expect(screen.getByText("14 жовт. 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Розгорнути Олена Коваль" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });
});

describe("job stages in Ukrainian", () => {
  it("heading, button, headers, a seeded stage and its status by the glossary", async () => {
    (getJobStageTypeList as any).mockResolvedValue({
      data: [
        {
          id: "t1",
          label: "Final / Onsite Interview",
          value: "final / onsite interview",
          sortOrder: 6,
          statusId: "s1",
          Status: { id: "s1", label: "Interview", value: "interview" },
          _count: { stages: 3 },
        },
      ],
      total: 1,
    });
    render(<JobStagesContainer />);

    expect(await screen.findByText("Фінальна співбесіда")).toBeInTheDocument();
    expect(screen.getByText("Співбесіда")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Етапи вакансій" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новий етап" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук етапів…")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Етап", "Статус", "Порядок", "Етапів", "Дії",
    ]);
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });
});
