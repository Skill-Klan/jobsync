"use server";

import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "@/actions/shared";
import { NOTIFICATION_CONSTANTS } from "@/lib/constants";
import { notificationCutoff } from "@/lib/notifications/prune";
import { getTranslations } from "@/i18n/server";
import { isFeatureOff } from "@/skillklan/featureFlags";
import type {
  NotificationItem,
  NotificationTab,
} from "@/models/notification.model";

const ERROR_KINDS = ["error", "board"];

const ITEM_SELECT = {
  id: true,
  kind: true,
  payload: true,
  occurrences: true,
  occurredAt: true,
  createdAt: true,
  readAt: true,
  dismissedAt: true,
  automation: { select: { id: true, name: true } },
} as const;

const ORDER = [{ occurredAt: "desc" as const }, { id: "desc" as const }];

function tabWhere(tab: NotificationTab): Prisma.NotificationWhereInput {
  if (tab === "unread") return { readAt: null };
  if (tab === "errors") return { kind: { in: ERROR_KINDS } };
  if (tab === "runs") return { kind: "run" };
  return {};
}

function toItems(rows: Array<{ payload: string } & Record<string, unknown>>) {
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })) as NotificationItem[];
}

// Notifications go with the Automations switch (Settings → «Функції», D75): a
// page opened before the switch went off still has its buttons, so every
// change refuses here too. Null — switched on, go ahead.
async function refuseWhileSwitchedOff() {
  if (!(await isFeatureOff("automations"))) return null;
  const t = await getTranslations("notifications.actions");
  return { success: false as const, message: t("switchedOff") };
}

export async function getNotificationSummary() {
  try {
    const user = await requireUser();
    const base = {
      userId: user.id,
      readAt: null,
      occurredAt: { gte: notificationCutoff() },
    };
    const [unread, unreadErrors] = await Promise.all([
      db.notification.count({ where: base }),
      db.notification.count({ where: { ...base, kind: { in: ERROR_KINDS } } }),
    ]);
    return { success: true, data: { unread, unreadErrors } };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("load"));
  }
}

export async function getPopoverNotifications() {
  try {
    const user = await requireUser();
    const rows = await db.notification.findMany({
      where: {
        userId: user.id,
        dismissedAt: null,
        occurredAt: { gte: notificationCutoff() },
      },
      select: ITEM_SELECT,
      orderBy: ORDER,
      take: NOTIFICATION_CONSTANTS.POPOVER_LIMIT,
    });
    return { success: true, data: toItems(rows) };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("load"));
  }
}

export async function getNotificationList({
  tab,
  automationId,
  skip = 0,
}: {
  tab: NotificationTab;
  automationId?: string;
  skip?: number;
}) {
  try {
    const user = await requireUser();
    const scope: Prisma.NotificationWhereInput = {
      userId: user.id,
      occurredAt: { gte: notificationCutoff() },
      ...(automationId ? { automationId } : {}),
    };
    const where = { ...scope, ...tabWhere(tab) };
    const [rows, total, all, unread, errors, runs] = await Promise.all([
      db.notification.findMany({
        where,
        select: ITEM_SELECT,
        orderBy: ORDER,
        skip,
        take: NOTIFICATION_CONSTANTS.PAGE_SIZE,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: scope }),
      db.notification.count({ where: { ...scope, ...tabWhere("unread") } }),
      db.notification.count({ where: { ...scope, ...tabWhere("errors") } }),
      db.notification.count({ where: { ...scope, ...tabWhere("runs") } }),
    ]);
    return {
      success: true,
      data: { items: toItems(rows), total, counts: { all, unread, errors, runs } },
    };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("load"));
  }
}

// Built from rows that exist, so a pick never yields an empty list.
export async function getNotificationFilterOptions() {
  try {
    const user = await requireUser();
    const options = await db.automation.findMany({
      where: {
        userId: user.id,
        notifications: { some: { occurredAt: { gte: notificationCutoff() } } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: options };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("loadAutomations"));
  }
}

export async function markNotificationRead(id: string) {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    await db.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("updateOne"));
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("updateAll"));
  }
}

// Popover ×: hidden there, kept on the page; read so the badge stays honest.
export async function dismissNotification(id: string) {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    const now = new Date();
    await db.notification.updateMany({
      where: { id, userId: user.id },
      data: { dismissedAt: now, readAt: now },
    });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("dismissOne"));
  }
}

// Popover "Clear all": every undismissed row, not just the loaded page.
export async function dismissAllNotifications() {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    const now = new Date();
    await db.notification.updateMany({
      where: { userId: user.id, dismissedAt: null },
      data: { dismissedAt: now, readAt: now },
    });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("clear"));
  }
}

export async function deleteNotification(id: string) {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    await db.notification.deleteMany({ where: { id, userId: user.id } });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("deleteOne"));
  }
}

export async function clearReadNotifications() {
  try {
    const user = await requireUser();
    const refused = await refuseWhileSwitchedOff();
    if (refused) return refused;
    await db.notification.deleteMany({
      where: { userId: user.id, readAt: { not: null } },
    });
    return { success: true };
  } catch (error) {
    return handleError(error, (await getTranslations("notifications.actions"))("clear"));
  }
}
