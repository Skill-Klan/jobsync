import { STAGE_OUTCOMES } from "@/lib/constants";
import { BadgeColor } from "@/lib/badge-colors";
import { DATE_PATTERNS, formatDate, type DatePattern } from "@/i18n/dates";

// What the helpers below say, in one language. The screen hands in the
// user's language (InterviewRow); the English default keeps each helper
// usable on its own.
export type DisplayText = {
  storedOutcome: (outcome: { value: string; label: string }) => string;
  scheduled: string;
  awaitingOutcome: string;
  notScheduled: string;
  notSet: string;
  noDate: string;
  noneLinked: string;
  interviewers: (count: number) => string;
  hours: (hours: number) => string;
  minutes: (minutes: number) => string;
  formatDate: (date: Date, pattern: DatePattern) => string;
};

export const ENGLISH_TEXT: DisplayText = {
  storedOutcome: (outcome) => outcome.label,
  scheduled: "Scheduled",
  awaitingOutcome: "Awaiting outcome",
  notScheduled: "Not scheduled",
  notSet: "Not set",
  noDate: "No date",
  noneLinked: "None linked",
  interviewers: (count) => `${count} interviewers`,
  hours: (hours) => `${hours}h`,
  minutes: (minutes) => `${minutes}m`,
  formatDate: (date, pattern) => formatDate(date, pattern, "en"),
};

// The day line of the When column: "Wed 23 Sep" / "ср, 23 верес."
export const WHEN_DAY: DatePattern = { en: "EEE d MMM", uk: "EEEEEE, d MMM" };

// A round created through Add Stage has no outcome — the field only appears
// when editing — so a null one is derived from the date rather than left as a
// dash. Nothing here is ever written back.
export function outcomeLabel(
  occurredAt: Date | null,
  outcome: string | null,
  now: Date = new Date(),
  text: DisplayText = ENGLISH_TEXT,
): string {
  const stored = STAGE_OUTCOMES.find((o) => o.value === outcome);
  if (stored) return text.storedOutcome(stored);
  if (!occurredAt) return text.notScheduled;
  return occurredAt.getTime() >= now.getTime()
    ? text.scheduled
    : text.awaitingOutcome;
}

// Keyed on the English label rather than the value, because three of the
// labels are derived (outcomeLabel) and have no stored value to key on.
const OUTCOME_BADGE_COLORS: Record<string, BadgeColor> = {
  Scheduled: "blue",
  Completed: "teal",
  Passed: "emerald",
  Failed: "red",
  "No-show": "red",
  Cancelled: "slate",
  "Awaiting outcome": "amber",
  "Not scheduled": "slate",
};

export function outcomeColor(label: string): BadgeColor {
  return OUTCOME_BADGE_COLORS[label] ?? "slate";
}

export type FormatIcon = "video" | "phone" | "location";

// JobStage.format is free text, so the icon is a guess that degrades to a
// neutral pin rather than to a wrong icon.
export function formatIconKind(value: string | null): FormatIcon {
  if (!value) return "location";
  if (/video|zoom|meet|teams|hangout|webex/i.test(value)) return "video";
  if (/phone|call|voice/i.test(value)) return "phone";
  return "location";
}

export function formatText(
  value: string | null,
  location: string | null,
  text: DisplayText = ENGLISH_TEXT,
): string {
  return location?.trim() || value?.trim() || text.notSet;
}

export function durationLabel(
  mins: number | null,
  text: DisplayText = ENGLISH_TEXT,
): string | null {
  if (!mins) return null;
  return mins >= 60 && mins % 60 === 0
    ? text.hours(mins / 60)
    : text.minutes(mins);
}

export function whenParts(
  occurredAt: Date | null,
  text: DisplayText = ENGLISH_TEXT,
): {
  day: string;
  time: string | null;
} {
  if (!occurredAt) return { day: text.noDate, time: null };
  return {
    day: text.formatDate(occurredAt, WHEN_DAY),
    time: text.formatDate(occurredAt, DATE_PATTERNS.time),
  };
}

function abbreviate(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return `${parts[0]![0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
}

export function interviewerSummary(
  interviewers: { Contact: { name: string } }[],
  text: DisplayText = ENGLISH_TEXT,
): string {
  if (interviewers.length === 0) return text.noneLinked;
  if (interviewers.length > 2) return text.interviewers(interviewers.length);
  return interviewers.map((i) => abbreviate(i.Contact.name)).join(", ");
}

export function prepSummary(prep: { asked: boolean }[]): string {
  const asked = prep.filter((p) => p.asked).length;
  return asked > 0 ? `${asked} / ${prep.length}` : String(prep.length);
}
