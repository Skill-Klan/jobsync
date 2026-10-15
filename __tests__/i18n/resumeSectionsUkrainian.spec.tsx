// Requirement — D29: a resume with fewer than 2 sections can't be made the
// default, copied, or picked for a job or an automation, and the person is
// told so in Ukrainian — in the table's warning marker, in the toast, and in
// what the server answers. "2" is written out, not read from the constant.
import { render, renderHook, screen } from "@testing-library/react";
import { PrismaClient } from "@prisma/client";
import DocumentTable from "@/components/profile/ResumeTable";
import { useWarnInsufficientResumeSections } from "@/utils/resumeSections.utils";
import { copyResume, setDefaultResume } from "@/actions/profile.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { toastError } from "@/lib/toast";
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
  "Додайте щонайменше 2 розділи, щоб обирати це резюме для вакансій та автопошуку. Прикріплений файл не враховується.";
const NOT_DEFAULT = "Додайте щонайменше 2 розділи, щоб зробити це резюме основним.";
const NOT_COPY = "Додайте щонайменше 2 розділи, щоб створити копію.";

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

  it("the toast names what can't be done", () => {
    const { result } = renderHook(() => useWarnInsufficientResumeSections());
    result.current("setDefault");
    expect(toastError).toHaveBeenLastCalledWith(NOT_DEFAULT, "Замало змісту");
    result.current("copy");
    expect(toastError).toHaveBeenLastCalledWith(NOT_COPY, "Замало змісту");
  });

  it("the server refuses to make it the default, in Ukrainian", async () => {
    (prisma.resume.findFirst as any).mockResolvedValue({ _count: { ResumeSections: 1 } });
    expect(await setDefaultResume("sparse")).toEqual({ success: false, message: NOT_DEFAULT });
  });

  it("the server refuses to copy it, in Ukrainian", async () => {
    (prisma.resume.findUnique as any).mockResolvedValue({ title: "Чернетка", ResumeSections: [{}] });
    const result = await copyResume("sparse", "Копія");
    expect(result).toMatchObject({ success: false, message: NOT_COPY });
  });
});
