"use server";

import db from "@/lib/db";
import { requireUser } from "../shared";
import type { AutomationWithResume, AutomationRun } from "@/models/automation.model";
import { APP_CONSTANTS } from "@/lib/constants";
import { formatError } from "./shared";
import { getTranslations } from "@/i18n/server";

export async function getAutomationsList(
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
): Promise<{
  success: boolean;
  data?: AutomationWithResume[];
  total?: number;
  message?: string;
}> {
  const t = await getTranslations("automations");
  try {
    const user = await requireUser();

    const skip = (page - 1) * limit;

    const [automations, total] = await Promise.all([
      db.automation.findMany({
        where: { userId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          resume: {
            select: { id: true, title: true },
          },
        },
      }),
      db.automation.count({ where: { userId: user.id } }),
    ]);

    return {
      success: true,
      data: automations as unknown as AutomationWithResume[],
      total,
    };
  } catch (error) {
    return formatError(error, t("errors.listFailed"));
  }
}

export async function getAutomationById(id: string): Promise<{
  success: boolean;
  data?: AutomationWithResume & { runs: AutomationRun[] };
  message?: string;
}> {
  const t = await getTranslations("automations");
  try {
    const user = await requireUser();

    const automation = await db.automation.findFirst({
      where: { id, userId: user.id },
      include: {
        resume: {
          select: { id: true, title: true },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!automation) {
      return { success: false, message: t("errors.notFound") };
    }

    return {
      success: true,
      data: automation as unknown as AutomationWithResume & {
        runs: AutomationRun[];
      },
    };
  } catch (error) {
    return formatError(error, t("errors.getFailed"));
  }
}
