"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import { APP_CONSTANTS } from "@/lib/constants";
import { resolveTag as resolveTagCore } from "@/lib/jobs/resolve";
import { getTranslations } from "@/i18n/server";
import { isFeatureOff } from "@/skillklan/featureFlags";

export const getAllTags = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const list = await prisma.tag.findMany({
      where: { createdBy: user.id },
      orderBy: { label: "asc" },
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch tag list. ";
    return handleError(error, msg);
  }
};

export const getTagList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  search?: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const skip = (page - 1) * limit;

    const whereClause: any = { createdBy: user.id };
    if (search) {
      whereClause.label = { contains: search };
    }

    const [data, total] = await Promise.all([
      prisma.tag.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          label: true,
          value: true,
          _count: { select: { jobs: true, questions: true, skills: true } },
        },
        orderBy: { jobs: { _count: "desc" } },
      }),
      prisma.tag.count({ where: whereClause }),
    ]);

    return { data, total };
  } catch (error) {
    const msg = "Failed to fetch tag list. ";
    return handleError(error, msg);
  }
};

export const createTag = async (label: string): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();

    if (!label.trim()) {
      throw new Error(t("errors.tag.emptyLabel"));
    }

    const { created: _, ...tag } = await resolveTagCore(label, user.id);
    return { data: tag, success: true };
  } catch (error) {
    const msg = t("errors.tag.createFailed");
    return handleError(error, msg);
  }
};

export const deleteTagById = async (
  tagId: string,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();
    // Deleting happens only in the Library. Switched off (Settings →
    // «Функції»): a page opened before still has its buttons — refuse here too.
    if (await isFeatureOff("library")) {
      return { success: false, message: t("errors.switchedOff") };
    }

    const [jobs, questions, skills] = await Promise.all([
      prisma.job.count({ where: { tags: { some: { id: tagId } } } }),
      prisma.question.count({ where: { tags: { some: { id: tagId } } } }),
      prisma.skill.count({ where: { tagId } }),
    ]);

    if (jobs > 0 || questions > 0 || skills > 0) {
      const links = [
        jobs > 0 ? t("skills.jobsCount", { count: jobs }) : "",
        questions > 0 ? t("skills.questionsCount", { count: questions }) : "",
        skills > 0 ? t("skills.skillsCount", { count: skills }) : "",
      ]
        .filter(Boolean)
        .join(` ${t("shared.and")} `);

      throw new Error(t("errors.tag.inUse", { links }));
    }

    const res = await prisma.tag.delete({
      where: { id: tagId, createdBy: user.id },
    });

    return { res, success: true };
  } catch (error) {
    const msg = t("errors.tag.deleteFailed");
    return handleError(error, msg);
  }
};
