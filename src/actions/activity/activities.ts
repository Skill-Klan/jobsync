"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { Activity } from "@/models/activity.model";
import { revalidatePath } from "next/cache";
import { requireUser } from "./shared";
import { getTranslations } from "@/i18n/server";
import { isFeatureOff } from "@/skillklan/featureFlags";

// Completed activities carry duration but no break state
const ACTIVITY_LIST_SELECT = {
  id: true,
  activityName: true,
  startTime: true,
  endTime: true,
  duration: true,
  description: true,
  createdAt: true,
  activityType: true,
};

export const getActivitiesList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  search?: string
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const offset = (page - 1) * limit;

    const whereClause: any = {
      userId: user.id,
      endTime: {
        not: null,
      },
    };

    if (search) {
      whereClause.OR = [
        { activityName: { contains: search } },
        { description: { contains: search } },
        { activityType: { label: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.activity.findMany({
        where: whereClause,
        select: ACTIVITY_LIST_SELECT,
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.activity.count({
        where: whereClause,
      }),
    ]);

    return {
      success: true,
      data,
      total,
    };
  } catch (error) {
    const msg = t("errors.listFailed");
    return handleError(error, msg);
  }
};

export const createActivity = async (
  data: Activity
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();
    // Activities switched off (Settings → «Функції»): a page opened before
    // the switch went off still has its buttons — refuse here too.
    if (await isFeatureOff("activities")) {
      return { success: false, message: t("errors.switchedOff") };
    }

    const {
      activityName,
      activityType,
      startTime,
      endTime,
      duration,
      description,
    } = data;

    const activity = await prisma.activity.create({
      data: {
        activityName,
        activityTypeId: activityType as string,
        userId: user.id,
        startTime,
        endTime,
        duration,
        description,
      },
    });
    revalidatePath("/dashboard");
    return { activity, success: true };
  } catch (error) {
    const msg = t("errors.createFailed");
    return handleError(error, msg);
  }
};

export const deleteActivityById = async (
  activityId: string
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();
    // Activities switched off (Settings → «Функції»): a page opened before
    // the switch went off still has its buttons — refuse here too.
    if (await isFeatureOff("activities")) {
      return { success: false, message: t("errors.switchedOff") };
    }

    const res = await prisma.activity.delete({
      where: {
        id: activityId,
        userId: user.id,
      },
    });
    revalidatePath("/dashboard");
    return { res, success: true };
  } catch (error) {
    const msg = t("errors.deleteFailed");
    return handleError(error, msg);
  }
};
