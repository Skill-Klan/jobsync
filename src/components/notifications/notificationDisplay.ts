import { createTranslator } from "use-intl/core";
import { useLocale, useTranslations } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import enNotifications from "@/i18n/messages/en/notifications.json";
import type {
  BoardErrorCode,
  BoardPayload,
  ErrorPayload,
  NotificationItem,
  RunPayload,
} from "@/models/notification.model";

// The words and date style of one language. The helpers below default to
// English — what the rows said before translation — so they stay pure and
// callable without a React tree; components pass the user's own.
export type NotificationText = {
  t: ReturnType<typeof createTranslator<Messages, "notifications">>;
  locale: Locale;
};

export const ENGLISH_NOTIFICATIONS: NotificationText = {
  locale: "en",
  // Only the notifications namespace is read, so only it is bundled here.
  t: createTranslator({
    locale: "en",
    messages: { notifications: enNotifications } as Messages,
    namespace: "notifications",
  }),
};

export function useNotificationText(): NotificationText {
  return { t: useTranslations("notifications"), locale: useLocale() };
}

const BOARD_COPY: Record<
  BoardErrorCode,
  `board.${"notFound" | "timeout" | "rateLimited" | "httpError" | "parse" | "network"}`
> = {
  not_found: "board.notFound",
  timeout: "board.timeout",
  rate_limited: "board.rateLimited",
  http_error: "board.httpError",
  parse: "board.parse",
  network: "board.network",
};

const monthDay = (d: Date, locale: Locale) =>
  d.toLocaleDateString(locale, { month: "short", day: "numeric" });

export function isErrorNotification(n: NotificationItem): boolean {
  return n.kind !== "run";
}

export function describeNotification(
  n: NotificationItem,
  { t, locale }: NotificationText = ENGLISH_NOTIFICATIONS,
) {
  const base = `/dashboard/automations/${n.automation.id}`;
  const name = n.automation.name;

  if (n.kind === "board") {
    const p = n.payload as BoardPayload;
    const repeat =
      n.occurrences > 1
        ? ` ${t("board.repeat", { count: n.occurrences, date: monthDay(new Date(n.createdAt), locale) })}`
        : "";
    // The status is the one detail the generic http_error copy would lose.
    // Matched in the server's own English reason, which is stored, not shown.
    const status = p.code === "http_error" ? p.reason.match(/returned (\d{3})/)?.[1] : undefined;
    return {
      icon: "warn" as const,
      title: t("board.title"),
      lead: `${p.provider} · ${p.companyName}`,
      detail: ` ${status ? t("board.returned", { status }) : t(BOARD_COPY[p.code])}${repeat}`,
      hint: p.reason,
      link: { label: t("board.editWatchlist"), href: `${base}?edit=1` },
    };
  }

  if (n.kind === "error") {
    const p = n.payload as ErrorPayload;
    const boards = p.boards.length
      ? ` (${p.boards.map((b) => b.companyName).join(", ")})`
      : "";
    return {
      icon: "fail" as const,
      title: t("error.title"),
      lead: t("jobsSaved", { count: p.jobsSaved }),
      // Reasons may already end in a period ("…no longer exists.").
      detail: ` · ${t("error.stopped", { name, reason: p.reason.replace(/\.$/, ""), boards })}`,
      hint: null,
      link: { label: t("error.openAutomation"), href: `${base}?tab=history` },
    };
  }

  const p = n.payload as RunPayload;
  const parts = [` · ${t("run.scanned", { count: p.jobsSearched })}`];
  if (p.belowThreshold > 0) parts.push(t("run.belowThreshold", { count: p.belowThreshold }));
  if (p.boardsFailed > 0) parts.push(t("run.boardsFailed", { count: p.boardsFailed }));
  if (p.aiError) parts.push(t("run.aiUnavailable"));
  return {
    icon: "run" as const,
    title: t("run.title", { name }),
    lead: p.jobsSaved > 0 ? t("jobsSaved", { count: p.jobsSaved }) : t("run.noNewJobs"),
    detail: parts.join(" · "),
    hint: null,
    link:
      p.jobsSaved > 0
        ? { label: t("run.review", { count: p.jobsSaved }), href: `${base}?tab=jobs` }
        : null,
  };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 24 * 60 * 60 * 1000;

export function formatShortAge(
  date: Date,
  now: Date = new Date(),
  { t, locale }: NotificationText = ENGLISH_NOTIFICATIONS,
): string {
  const d = new Date(date);
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY);
  if (days === 0) {
    if (mins < 1) return t("age.now");
    if (mins < 60) return t("age.minutes", { count: mins });
    return t("age.hours", { count: Math.floor(mins / 60) });
  }
  if (days === 1) return t("age.yesterday");
  if (days < 7) return d.toLocaleDateString(locale, { weekday: "short" });
  return monthDay(d, locale);
}

export function formatClock(date: Date, locale: Locale = "en"): string {
  return new Date(date).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

const DAY_GROUPS = ["today", "yesterday", "thisWeek", "earlier"] as const;

export function groupByDay(
  items: NotificationItem[],
  now: Date = new Date(),
  { t }: NotificationText = ENGLISH_NOTIFICATIONS,
) {
  const today = startOfDay(now).getTime();
  // Week starts Monday.
  const weekStart = today - ((now.getDay() + 6) % 7) * DAY;
  const group = (d: Date): (typeof DAY_GROUPS)[number] => {
    const day = startOfDay(new Date(d)).getTime();
    if (day === today) return "today";
    if (day === today - DAY) return "yesterday";
    if (day >= weekStart) return "thisWeek";
    return "earlier";
  };
  return DAY_GROUPS
    .map((g) => ({ label: t(`groups.${g}`), items: items.filter((i) => group(i.occurredAt) === g) }))
    .filter((g) => g.items.length > 0);
}
