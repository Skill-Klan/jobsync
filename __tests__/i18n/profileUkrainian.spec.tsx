// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// the Profile area — the documents list, the resume page, the import review
// and the PDF export settings — speaks Ukrainian: «резюме», «супровідний
// лист», verbs on buttons, dates day first. What the person typed (titles,
// names, section headings) is shown as typed.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTranslator } from "use-intl/core";
import { MESSAGES } from "@/i18n/messages";
import type { ProfileDocument, Resume } from "@/models/profile.model";
import { SectionType } from "@/models/profile.model";
import { defaultResumeExportSettings } from "@/models/resumeExport.model";
import { setTestLocale } from "../helpers/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/profile",
}));
vi.mock("@/actions/profile.actions", () => ({
  getResumeList: vi.fn(async () => ({ data: [], total: 0, success: true, message: "" })),
  getDefaultResumeId: vi.fn(async () => null),
  getDefaultContactInfo: vi.fn(async () => null),
  deleteResumeById: vi.fn(),
  setDefaultResume: vi.fn(),
  deleteCertification: vi.fn(),
  deleteSkillsSection: vi.fn(),
  copyResume: vi.fn(),
  getResumeCopyTitleSuggestion: vi.fn(),
  addContactInfo: vi.fn(),
  updateContactInfo: vi.fn(),
  addResumeSummary: vi.fn(),
  updateResumeSummary: vi.fn(),
  addExperience: vi.fn(),
  updateExperience: vi.fn(),
  addEducation: vi.fn(),
  updateEducation: vi.fn(),
  addCertification: vi.fn(),
  updateCertification: vi.fn(),
  addSkillsSection: vi.fn(),
  updateSkillsSection: vi.fn(),
}));
vi.mock("@/actions/coverLetter.actions", () => ({
  getCoverLetterList: vi.fn(async () => ({ data: [], total: 0, success: true, message: "" })),
  deleteCoverLetterById: vi.fn(),
  createCoverLetter: vi.fn(),
  updateCoverLetter: vi.fn(),
}));
vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: vi.fn(async () => ({ success: false })),
}));
vi.mock("@/actions/resumeImport.actions", () => ({ resolveImportCard: vi.fn() }));
vi.mock("@/actions/company.actions", () => ({ getAllCompanies: vi.fn(async () => []) }));
vi.mock("@/actions/jobtitle.actions", () => ({ getAllJobTitles: vi.fn(async () => []) }));
vi.mock("@/actions/jobLocation.actions", () => ({ getAllJobLocations: vi.fn(async () => []) }));
vi.mock("@/actions/tag.actions", () => ({ getAllTags: vi.fn(async () => []) }));
vi.mock("@/utils/ai.utils", () => ({
  checkOllamaConnection: vi.fn(async () => ({ isConnected: false })),
}));
vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => ({ open: vi.fn(), sendMessage: vi.fn(), clear: vi.fn(async () => {}), approvalPending: false }),
}));

import ProfileContainer from "@/components/profile/ProfileContainer";
import DocumentTable from "@/components/profile/ResumeTable";
import ResumeContainer from "@/components/profile/ResumeContainer";
import { ImportReviewBanner } from "@/components/profile/resume-container/ImportReviewBanner";
import { ExportSettingsPanel } from "@/components/profile/export-pdf-dialog/ExportSettingsPanel";

beforeAll(() => {
  // Radix Select in jsdom — the shim TaskForm.spec established.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
});

beforeEach(() => setTestLocale("uk"));

// Whole words a person saw in this area before translation.
const englishLeft = (text: string | null) =>
  (text ?? "").match(
    /\b(Profile|New|Add|Save|Cancel|Delete|Edit|Default|Resume|Cover Letter|Title|Type|Created|Updated|Jobs|Actions|Present|Issued|Review|Accept|Discard|Template|Typography|Layout|Footer|Font size|Reset)\b/g,
  ) ?? [];

describe("documents list (Профіль)", () => {
  it("heading, the New menu and the create dialog are Ukrainian", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<ProfileContainer />);
    });

    expect(screen.getByRole("heading", { name: "Профіль" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Створити" }));
    expect(await screen.findByRole("menuitem", { name: "Додати супровідний лист" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Додати резюме" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Створити резюме" })).toBeInTheDocument();
    expect(within(dialog).getByText("Створіть нове резюме для свого профілю.")).toBeInTheDocument();
    expect(within(dialog).getByText("Назва резюме")).toBeInTheDocument();
    expect(within(dialog).getByText("Завантажити резюме (необовʼязково)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
    expect(englishLeft(document.body.textContent)).toEqual([]);
  });

  it("table: headers, type badges, the default badge, day-first dates, the row menu", async () => {
    const user = userEvent.setup();
    const day = new Date(2026, 9, 14);
    const docs: ProfileDocument[] = [
      { id: "r1", title: "Моє CV", type: "resume", createdAt: day, updatedAt: day, jobCount: 0, isDefault: true, sectionCount: 3 },
      { id: "c1", title: "Лист в Acme", type: "cover-letter", createdAt: day, updatedAt: day, jobCount: 0, content: "<p>Привіт</p>" },
    ];
    render(
      <DocumentTable
        documents={docs}
        editResume={vi.fn()}
        editCoverLetter={vi.fn()}
        exportCoverLetter={vi.fn()}
        copyResume={vi.fn()}
        reloadDocuments={vi.fn()}
        defaultResumeId="r1"
      />,
    );

    for (const name of ["Назва", "Тип", "Створено", "Оновлено", "Вакансії"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Основне")).toBeInTheDocument();
    expect(screen.getByText("Резюме")).toBeInTheDocument();
    expect(screen.getByText("Супровідний лист")).toBeInTheDocument();
    expect(screen.getAllByText("14 жовт. 2026")).toHaveLength(4);

    await user.click(screen.getAllByTestId("document-actions-menu-btn")[0]);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Дії")).toBeInTheDocument();
    for (const name of ["Редагувати назву", "Переглянути й редагувати", "Створити копію", "Видалити"]) {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    }
    expect(englishLeft(document.body.textContent)).toEqual([]);
  });
});

describe("resume page", () => {
  const resume: Resume = {
    id: "r1",
    title: "CV тестувальниці",
    ContactInfo: {
      id: "ci1",
      resumeId: "r1",
      firstName: "Олена",
      lastName: "Коваль",
      headline: "QA-інженерка",
      email: "olena@example.invalid",
      phone: "+380000000000",
    } as Resume["ContactInfo"],
    ResumeSections: [
      {
        id: "s1",
        resumeId: "r1",
        sectionTitle: "Досвід роботи",
        sectionType: SectionType.EXPERIENCE,
        workExperiences: [
          {
            id: "w1",
            jobTitle: { id: "jt", label: "QA Engineer", value: "qa" },
            Company: { id: "co", label: "Acme", value: "acme" },
            location: { id: "lo", label: "Київ", value: "kyiv" },
            startDate: new Date(2020, 0, 1),
            endDate: null,
            description: "<p>Тестування</p>",
          },
        ],
      },
      {
        id: "s2",
        resumeId: "r1",
        sectionTitle: "Сертифікати",
        sectionType: SectionType.CERTIFICATION,
        licenseOrCertifications: [
          {
            id: "l1",
            title: "ISTQB Foundation",
            organization: "ISTQB",
            issueDate: new Date(2021, 2, 1),
            expirationDate: null,
            credentialUrl: "https://example.invalid/badge",
          },
        ],
      },
    ] as unknown as Resume["ResumeSections"],
  };

  it("header buttons, the default badge, experience and certification lines", () => {
    render(<ResumeContainer resume={resume} defaultResumeId="r1" />);

    expect(screen.getByTitle("Назад")).toBeInTheDocument();
    expect(screen.getByText("Основне")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати розділ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Оцінити" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Редагувати" }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();

    // Typed by the person — as typed.
    expect(screen.getByRole("heading", { name: "Досвід роботи" })).toBeInTheDocument();
    // Month first in Ukrainian is the standalone short month; "Present" → «дотепер».
    expect(document.body.textContent).toContain("січ. 2020 - дотепер");
    expect(document.body.textContent).toContain("Видано: берез. 2021 · Безстроково");
    expect(screen.getByRole("link", { name: "Переглянути сертифікат" })).toBeInTheDocument();
    expect(englishLeft(document.body.textContent)).toEqual([]);
  });

  it("import review banner: what was pre-filled, cards, accept, discard", () => {
    render(
      <ImportReviewBanner
        pendingCards={[
          { id: "contactInfo", card: { type: "contactInfo", data: { firstName: "Олена", lastName: "Коваль", email: "o@example.invalid" } as never } },
          { id: "experience-0", card: { type: "experience", data: { jobTitle: "QA", company: "Acme", startDate: "2020", endDate: "Present" } as never } },
        ]}
        isStructuring={false}
        importTruncated
        unrecognizedSections={["Hobbies"]}
        onAccept={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardImport={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/^Ми заповнили це резюме з вашого документа\. Перегляньте кожен пункт і прийміть потрібні\. Імпортовано лише перші 5 сторінок\.$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Деякі розділи не вдалося імпортувати (Hobbies) — резюме поки що їх не підтримує."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Відмовитися від імпорту" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Прийняти" })).toHaveLength(2);
    expect(screen.getByText("Контактні дані")).toBeInTheDocument();
    expect(screen.getByText("Досвід")).toBeInTheDocument();
    for (const label of ["Імʼя", "Ел. пошта", "Посада", "Компанія", "Період"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("PDF export settings", () => {
  it("groups, the template names, stepper labels and buttons are Ukrainian", () => {
    render(
      <ExportSettingsPanel
        settings={defaultResumeExportSettings}
        onChange={vi.fn()}
        onReset={vi.fn()}
        isDefault={false}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Шаблон" })).toHaveTextContent("Простий");
    for (const name of ["Типографіка", "Відступи", "Нижній колонтитул"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Розмір шрифту")).toBeInTheDocument();
    expect(screen.getByLabelText("Міжрядковий інтервал")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Розмір шрифту: зменшити" })).toBeInTheDocument();
    expect(screen.getByLabelText("Показувати номери сторінок")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скинути налаштування" })).toBeInTheDocument();
    expect(englishLeft(document.body.textContent)).toEqual([]);
  });

  it("page counts use the Ukrainian plural forms", () => {
    const t = createTranslator({ locale: "uk", messages: MESSAGES.uk, namespace: "profile" });
    const pages = (count: number) => t("pdfPreview.pages", { count });
    expect([1, 2, 5, 11, 21, 22].map(pages)).toEqual([
      "1 сторінка", "2 сторінки", "5 сторінок", "11 сторінок", "21 сторінка", "22 сторінки",
    ]);
  });
});
