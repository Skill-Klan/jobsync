import { format } from "date-fns";
import type { Locale } from "./config";
import { dateFnsLocale } from "./dateFns";

// A date pattern per language. English keeps the pattern the screen used
// before translation (the suite asserts on it); Ukrainian puts the day first
// and uses 24-hour time. `LLLL` is the standalone month ("жовтень 2026"),
// `MMMM` the one inside a date ("14 жовтня 2026").
export type DatePattern = { en: string; uk: string };

export const DATE_PATTERNS = {
  date: { en: "MMM d, yyyy", uk: "d MMM yyyy" },
  dateLong: { en: "MMMM d, yyyy", uk: "d MMMM yyyy" },
  dateNumeric: { en: "MM/dd/yyyy", uk: "dd.MM.yyyy" },
  dayMonth: { en: "MMM d", uk: "d MMM" },
  dateTime: { en: "MMM d, yyyy h:mm a", uk: "d MMM yyyy, HH:mm" },
  time: { en: "h:mm a", uk: "HH:mm" },
  monthYear: { en: "MMMM yyyy", uk: "LLLL yyyy" },
} satisfies Record<string, DatePattern>;

export function formatDate(date: Date | number, pattern: DatePattern, locale: Locale): string {
  return format(date, pattern[locale], { locale: dateFnsLocale(locale) });
}
