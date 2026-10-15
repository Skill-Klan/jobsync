import { createTranslator } from "use-intl/core";
import { TERMINAL_STAGE_STATUSES } from "@/lib/constants";
import type { JobStage, JobStageTypeRef } from "@/models/jobStage.model";
import { TIME_ZONE, type Locale } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { fallbackMessage } from "@/i18n/fallback";
import { DATE_PATTERNS, formatDate, type DatePattern } from "@/i18n/dates";
import { labelFor, type LabelsTranslator } from "@/i18n/labels";

// Plain functions, not hooks, so callers pass the user's locale (useLocale()).
// It defaults to English, the language the suite asserts in.
const STAGE_DATE_TIME: DatePattern = {
  en: "MMM d, yyyy · h:mm a",
  uk: "d MMM yyyy · HH:mm",
};

const translators = new Map<Locale, ReturnType<typeof makeTranslators>>();

function makeTranslators(locale: Locale) {
  const base = { locale, messages: MESSAGES[locale], timeZone: TIME_ZONE, getMessageFallback: fallbackMessage };
  return {
    t: createTranslator({ ...base, namespace: "jobs.timeline" }),
    labels: createTranslator({ ...base, namespace: "labels" }) as unknown as LabelsTranslator,
  };
}

function translatorsFor(locale: Locale) {
  let found = translators.get(locale);
  if (!found) {
    found = makeTranslators(locale);
    translators.set(locale, found);
  }
  return found;
}

// An undated stage renders an em dash, never a fabricated date or a blank.
export function formatStageDate(occurredAt: Date | null, locale: Locale = "en"): string {
  return occurredAt ? formatDate(occurredAt, DATE_PATTERNS.dayMonth, locale) : "—";
}

// "Scheduled for" only while the stage is still ahead (the artboard's wording,
// kept where it is true): a past stage that reads "Scheduled for" a date
// already gone is wrong, and the prefix doubles as the upcoming/done signal.
export function formatStageDateTime(
  occurredAt: Date | null,
  durationMins: number | null,
  locale: Locale = "en",
): string {
  const { t } = translatorsFor(locale);
  if (!occurredAt) return t("noDate");
  const base = formatDate(occurredAt, STAGE_DATE_TIME, locale);
  const withDuration = durationMins
    ? `${base} · ${t("minutes", { count: durationMins })}`
    : base;
  return occurredAt.getTime() > Date.now()
    ? t("scheduledFor", { when: withDuration })
    : withDuration;
}

// The subtitle both stage dialogs put under their title.
export function stageHeading(stage: JobStage, locale: Locale = "en"): string {
  const { t, labels } = translatorsFor(locale);
  const label = stage.StageType ? labelFor(labels, "jobStage", stage.StageType) : t("stage");
  return stage.occurredAt
    ? `${label} · ${formatDate(stage.occurredAt, DATE_PATTERNS.date, locale)}`
    : label;
}

export function stageInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// The gate is stage KIND, never stage timing: an interview a week away is
// still an interview stage.
export function isInterviewStage(stage: JobStage): boolean {
  return stage.StageType?.Status?.value === "interview";
}

// One greyed step per unreached terminal STATUS, not per type (D6): a user
// whose Library holds a custom "Verbal Offer" under the offer status would
// otherwise get two greyed Offer steps side by side.
export function terminalStagesFor(
  stages: JobStage[],
  stageTypes: JobStageTypeRef[],
): JobStageTypeRef[] {
  const reachedStatuses = new Set(
    stages.map((s) => s.StageType?.Status?.value).filter(Boolean),
  );
  const terminal = new Set<string>(TERMINAL_STAGE_STATUSES);

  const byStatus = new Map<string, JobStageTypeRef>();
  for (const type of [...stageTypes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const status = type.Status?.value ?? "";
    if (!terminal.has(status)) continue;
    if (reachedStatuses.has(status)) continue;
    if (!byStatus.has(status)) byStatus.set(status, type);
  }
  return [...byStatus.values()];
}

export function askedTally(stage: JobStage): { asked: number; total: number } {
  const rows = stage.prepQuestions ?? [];
  return { asked: rows.filter((r) => r.asked).length, total: rows.length };
}
