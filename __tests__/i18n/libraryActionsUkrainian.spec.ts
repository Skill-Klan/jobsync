// @vitest-environment node
// Requirement — D29: what the Library's server actions say to a person (a
// refused delete, a board that cannot be found) is in the person's language.
// English stays exactly as it was — including the quotes around a token,
// which ICU would swallow if written as a bare apostrophe.
import { resolveAtsBoard } from "@/actions/atsCompany.actions";
import { deleteCompanyById } from "@/actions/company.actions";
import { createJobStageType } from "@/actions/jobStageType.actions";
import { deleteTagById } from "@/actions/tag.actions";
import { getCurrentUser } from "@/utils/user.utils";
import prisma from "@/lib/db";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/lib/db", () => ({
  default: {
    workExperience: { count: vi.fn() },
    job: { count: vi.fn() },
    contact: { count: vi.fn() },
    company: { delete: vi.fn() },
    question: { count: vi.fn() },
    skill: { count: vi.fn() },
    tag: { delete: vi.fn() },
    jobStatus: { findUnique: vi.fn() },
    jobStageType: { findFirst: vi.fn() },
  },
}));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/jobs/resolve", () => ({ resolveJobStageType: vi.fn(), resolveTag: vi.fn() }));

const db = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as any).mockResolvedValue({ id: "u1" });
});

afterEach(() => vi.restoreAllMocks());

describe("board lookup messages", () => {
  it("a malformed Lever token — Ukrainian, with the token quoted", async () => {
    setTestLocale("uk");
    await expect(resolveAtsBoard("lever", "bad token!")).resolves.toEqual({
      success: false,
      message: "Некоректний токен Lever «bad token!»",
    });
  });

  it("the same in English keeps its apostrophes", async () => {
    await expect(resolveAtsBoard("lever", "bad token!")).resolves.toEqual({
      success: false,
      message: "Invalid Lever token 'bad token!'",
    });
  });

  it("a link that is not a Greenhouse board", async () => {
    setTestLocale("uk");
    await expect(resolveAtsBoard("greenhouse", "https://example.com/jobs")).resolves.toEqual({
      success: false,
      message: "Вставте посилання boards.greenhouse.io або токен дошки",
    });
  });

  it("an Ashby board that does not exist — in both languages", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 404, body: null } as Response);
    setTestLocale("uk");
    expect((await resolveAtsBoard("ashby", "acme")) as { message: string }).toEqual({
      success: false,
      message: "Дошку Ashby «acme» не знайдено",
    });
    setTestLocale("en");
    expect((await resolveAtsBoard("ashby", "acme")) as { message: string }).toEqual({
      success: false,
      message: "No Ashby board found for 'acme'",
    });
  });
});

describe("refused deletes", () => {
  it("a company with jobs — the count in a Ukrainian plural", async () => {
    db.workExperience.count.mockResolvedValue(0);
    db.job.count.mockResolvedValue(2);
    setTestLocale("uk");
    expect(await deleteCompanyById("co1")).toEqual({
      success: false,
      message: "Компанію не можна видалити: до неї привʼязано 2 вакансії.",
    });
    expect(db.company.delete).not.toHaveBeenCalled();
  });

  it("a skill in use — every link named, joined in Ukrainian", async () => {
    db.job.count.mockResolvedValue(5);
    db.question.count.mockResolvedValue(1);
    db.skill.count.mockResolvedValue(0);
    setTestLocale("uk");
    expect(await deleteTagById("t1")).toEqual({
      success: false,
      message: "Навичку не можна видалити: її привʼязано до 5 вакансій і 1 питання.",
    });
  });
});

describe("a stage name already taken", () => {
  it("names the stage and its status by the glossary", async () => {
    db.jobStatus.findUnique.mockResolvedValue({ id: "s-app", label: "Applied", value: "applied" });
    db.jobStageType.findFirst.mockResolvedValue({
      label: "2nd Technical Interview",
      value: "2nd technical interview",
      Status: { label: "Interview", value: "interview" },
    });
    setTestLocale("uk");
    expect(await createJobStageType("2nd Technical Interview", "s-app")).toEqual({
      success: false,
      message: "Етап «Технічна співбесіда» вже є в статусі «Співбесіда».",
    });
  });
});
