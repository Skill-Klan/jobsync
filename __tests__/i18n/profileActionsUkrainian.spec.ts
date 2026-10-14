// Requirement — D29: what the profile server actions return as `message` is
// shown to the person as a toast, so it is in the person's language; English
// stays exactly as before.
import { deleteResumeById, getResumeList, setDefaultResume } from "@/actions/profile.actions";
import { resolveImportCard } from "@/actions/resumeImport.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import { setTestLocale } from "../helpers/i18n";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const client = {
    resume: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as any).mockResolvedValue({ id: "user-1" });
});

describe("profile action messages in Ukrainian", () => {
  it("setting someone else's resume as default", async () => {
    setTestLocale("uk");
    (prisma.resume.findFirst as any).mockResolvedValue(null);
    await expect(setDefaultResume("r-x")).resolves.toEqual({ success: false, message: "Резюме не знайдено" });
  });

  it("deleting a resume that is not there", async () => {
    setTestLocale("uk");
    (prisma.resume.findUnique as any).mockResolvedValue(null);
    await expect(deleteResumeById("r-x")).resolves.toEqual({
      success: false,
      message: "Резюме не знайдено або доступ заборонено",
    });
  });

  it("a failure without its own text falls back to the action's message", async () => {
    setTestLocale("uk");
    (prisma.user.findUnique as any).mockRejectedValue("db down");
    (prisma.resume.count as any).mockResolvedValue(0);
    await expect(getResumeList(1, 10)).resolves.toEqual({
      success: false,
      message: "Не вдалося отримати список резюме.",
    });
  });

  it("accepting an imported skills card with no skills", async () => {
    setTestLocale("uk");
    (prisma.resume.findUnique as any).mockResolvedValue({ id: "r1" });
    await expect(
      resolveImportCard("r1", { type: "skills", data: { categories: [] } }),
    ).resolves.toEqual({ success: false, message: "Немає навичок для імпорту" });
  });

  it("in English the messages are the ones the app always had", async () => {
    (prisma.resume.findFirst as any).mockResolvedValue(null);
    await expect(setDefaultResume("r-x")).resolves.toEqual({ success: false, message: "Resume not found" });
    (prisma.resume.findUnique as any).mockResolvedValue({ id: "r1" });
    await expect(
      resolveImportCard("r1", { type: "skills", data: { categories: [] } }),
    ).resolves.toEqual({ success: false, message: "No skills to import" });
  });
});
