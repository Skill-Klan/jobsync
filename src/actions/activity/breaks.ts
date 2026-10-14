"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import {
  RUNNING_ACTIVITY_SELECT,
  breakMinutesSince,
  clampBreakMinutes,
  requireUser,
} from "./shared";
import { getTranslations } from "@/i18n/server";

export const startBreak = async (
  activityId: string,
  plannedMinutes: number,
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId: user.id, endTime: null },
    });

    if (!activity) {
      throw new Error(t("errors.notFound"));
    }

    if (activity.breakStartedAt) {
      return { success: false, message: t("errors.breakInProgress") };
    }

    const updated = await prisma.activity.update({
      where: { id: activityId, userId: user.id },
      data: {
        breakStartedAt: new Date(),
        breakPlannedMins: clampBreakMinutes(plannedMinutes),
      },
      select: RUNNING_ACTIVITY_SELECT,
    });

    return { activity: updated, success: true };
  } catch (error) {
    const msg = t("errors.breakStartFailed");
    return handleError(error, msg);
  }
};

export const endBreak = async (
  activityId: string,
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId: user.id, endTime: null },
      select: RUNNING_ACTIVITY_SELECT,
    });

    if (!activity) {
      throw new Error(t("errors.notFound"));
    }

    // Resuming twice (two tabs, or a retry) must not double-count.
    if (!activity.breakStartedAt) {
      return { activity, success: true };
    }

    const updated = await prisma.activity.update({
      where: { id: activityId, userId: user.id },
      data: {
        breakMinutes:
          activity.breakMinutes + breakMinutesSince(activity.breakStartedAt),
        breakStartedAt: null,
        breakPlannedMins: null,
      },
      select: RUNNING_ACTIVITY_SELECT,
    });

    return { activity: updated, success: true };
  } catch (error) {
    const msg = t("errors.breakEndFailed");
    return handleError(error, msg);
  }
};

export const updateBreakLength = async (
  activityId: string,
  plannedMinutes: number,
): Promise<any | undefined> => {
  const t = await getTranslations("activities");
  try {
    const user = await requireUser();

    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId: user.id, endTime: null },
    });

    if (!activity?.breakStartedAt) {
      return { success: false, message: t("errors.noBreak") };
    }

    const updated = await prisma.activity.update({
      where: { id: activityId, userId: user.id },
      data: { breakPlannedMins: clampBreakMinutes(plannedMinutes) },
      select: RUNNING_ACTIVITY_SELECT,
    });

    return { activity: updated, success: true };
  } catch (error) {
    const msg = t("errors.breakLengthFailed");
    return handleError(error, msg);
  }
};
