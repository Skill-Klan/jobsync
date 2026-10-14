"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "../shared";
import { getTranslations } from "@/i18n/server";

export const startActivityFromTask = async (
  taskId: string
): Promise<any | undefined> => {
  const t = await getTranslations("tasks");
  try {
    const user = await requireUser();

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
    });

    if (!task) {
      return { success: false, message: t("errors.notFound") };
    }

    if (task.status === "complete" || task.status === "cancelled") {
      return {
        success: false,
        message: t("errors.startFromClosed"),
      };
    }

    if (!task.activityTypeId) {
      return {
        success: false,
        message: t("errors.startWithoutType"),
      };
    }

    const runningActivity = await prisma.activity.findFirst({
      where: {
        userId: user.id,
        endTime: null,
      },
    });

    if (runningActivity) {
      return {
        success: false,
        message: t("errors.activityRunning"),
      };
    }

    // A task can have many activities over time; each start links a new one
    // to the task so per-task time can be tracked.
    const activity = await prisma.activity.create({
      data: {
        activityName: task.title,
        activityTypeId: task.activityTypeId,
        userId: user.id,
        startTime: new Date(),
        endTime: null,
        taskId: task.id,
      },
      include: {
        activityType: true,
      },
    });

    return { success: true, data: activity };
  } catch (error) {
    const msg = t("errors.startFailed");
    return handleError(error, msg);
  }
};
