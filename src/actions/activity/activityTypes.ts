"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { requireUser } from "./shared";
import { getTranslations } from "@/i18n/server";

export const getAllActivityTypes = async (): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const activityTypes = await prisma.activityType.findMany({
      where: {
        createdBy: user.id,
      },
    });
    return activityTypes;
  } catch (error) {
    const msg = t("errors.typesFetchFailed");
    return handleError(error, msg);
  }
};

export const createActivityType = async (
  label: string
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const value = label.trim().toLowerCase();

    const upsertedActivityType = await prisma.activityType.upsert({
      where: { value_createdBy: { value, createdBy: user.id } },
      update: { label },
      create: { label, value, createdBy: user.id },
    });

    return upsertedActivityType;
  } catch (error) {
    const msg = t("errors.typeCreateFailed");
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getActivityTypeList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const skip = (page - 1) * limit;
    const whereClause = { createdBy: user.id };

    const [total, durationSums] = await Promise.all([
      prisma.activityType.count({ where: whereClause }),
      prisma.activity.groupBy({
        by: ["activityTypeId"],
        where: { userId: user.id, endTime: { not: null } },
        _sum: { duration: true },
      }),
    ]);

    const durationMap = new Map(
      durationSums.map((d) => [d.activityTypeId, d._sum.duration ?? 0]),
    );

    // Fetch all activity types with counts, then sort by total duration
    const allTypes = await prisma.activityType.findMany({
      where: whereClause,
      select: {
        id: true,
        label: true,
        value: true,
        _count: { select: { Activities: true, Tasks: true } },
      },
    });

    const sorted = allTypes
      .map((t) => ({ ...t, totalDuration: durationMap.get(t.id) ?? 0 }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    const data = sorted.slice(skip, skip + limit);

    return { data, total };
  } catch (error) {
    const msg = t("errors.typeListFailed");
    return handleError(error, msg);
  }
};

export const deleteActivityTypeById = async (
  activityTypeId: string,
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const [activities, tasks] = await Promise.all([
      prisma.activity.count({ where: { activityTypeId, userId: user.id } }),
      prisma.task.count({ where: { activityTypeId, userId: user.id } }),
    ]);

    if (activities > 0 || tasks > 0) {
      const linkedActivities = t("errors.typeLinkedActivities", {
        count: activities,
      });
      const linkedTasks = t("errors.typeLinkedTasks", { count: tasks });
      const links =
        activities > 0 && tasks > 0
          ? t("errors.typeLinkedBoth", {
              activities: linkedActivities,
              tasks: linkedTasks,
            })
          : activities > 0
            ? linkedActivities
            : linkedTasks;

      throw new Error(t("errors.typeLinked", { links }));
    }

    const res = await prisma.activityType.delete({
      where: { id: activityTypeId, createdBy: user.id },
    });

    return { res, success: true };
  } catch (error) {
    const msg = t("errors.typeDeleteFailed");
    return handleError(error, msg);
  }
};
