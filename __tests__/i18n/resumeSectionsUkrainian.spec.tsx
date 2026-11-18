// Requirement — D29 (Ukrainian interface) and the owner, 2026-11: a resume with
// fewer than 2 sections is no longer refused anywhere (default, copy, job,
// automation) — the AI is optional. The person is told in Ukrainian what such a
// resume cannot do: in the table's marker and in the automation step.
// "2" is written out, not read from the constant.
import { render, screen } from "@testing-library/react";
import { PrismaClient } from "@prisma/client";
import DocumentTable from "@/components/profile/ResumeTable";
import { copyResume, setDefaultResume } from "@/actions/profile.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { setTestLocale } from "../helpers/i18n";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const client = {
    resume: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/actions/coverLetter.actions", () => ({ deleteCoverLetterById: vi.fn() }));

const HINT =
  "Менше ніж 2 розділи: AI-функції (збіг із вакансією, огляд, супровідний лист) для цього резюме недоступні. Резюме можна використовувати й без них. Прикріплений файл не враховується.";

beforeEach(() => {
  vi.clearAllMocks();
  setTestLocale("uk");
  (getCurrentUser as any).mockResolvedValue({ id: "user-1" });
});

describe("too few resume sections, in Ukrainian", () => {
  it("the table marks the resume with the Ukrainian hint", () => {
    render(
      <DocumentTable
        documents={[
          {
            id: "r1",
            type: "resume",
            title: "Чернетка",
            sectionCount: 0,
            FileId: "f1",
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
            jobCount: 0,
          } as any,
        ]}
        editResume={vi.fn()}
        editCoverLetter={vi.fn()}
        exportCoverLetter={vi.fn()}
        copyResume={vi.fn()}
        reloadDocuments={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: HINT })).toBeInTheDocument();
  });

  it("the server lets it be the default", async () => {
    (prisma.resume.findFirst as any).mockResolvedValue({ id: "sparse" });
    (prisma.user.update as any).mockResolvedValue({});
    expect(await setDefaultResume("sparse")).toEqual({ success: true });
  });

  it("the server does not refuse to copy it for lack of sections", async () => {
    (prisma.resume.findUnique as any).mockResolvedValue({ title: "Чернетка", ResumeSections: [{}] });
    (prisma.resume.findMany as any).mockResolvedValue([]);
    (prisma.$transaction as any).mockResolvedValue({ id: "copy", title: "Копія" });
    const result = await copyResume("sparse", "Копія");
    expect(result).not.toMatchObject({ message: expect.stringContaining("розділ") });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
