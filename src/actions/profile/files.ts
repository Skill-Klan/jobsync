"use server";
import prisma from "@/lib/db";
import fs from "fs";
import { isResumeFilePath } from "@/lib/resumeFiles";
import { log } from "@/lib/telemetry";
import { requireUser } from "./shared";
import { getTranslations } from "@/i18n/server";

export const deleteFile = async (fileId: string) => {
  const t = await getTranslations("profile");
  const user = await requireUser();

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      Resume: { profile: { userId: user.id } },
    },
  });

  if (!file) {
    throw new Error(t("errors.fileNotFoundOrDenied"));
  }

  // A row may predate path confinement; drop it without touching the disk
  if (!isResumeFilePath(file.filePath)) {
    log.warn("[Resume] Skipped unlinking a path outside the resumes directory", {
      "file.path": file.filePath,
    });
  } else if (fs.existsSync(file.filePath)) {
    fs.unlinkSync(file.filePath);
  }

  await prisma.file.delete({ where: { id: fileId } });
};
