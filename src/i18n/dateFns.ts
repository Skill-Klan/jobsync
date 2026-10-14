import { enUS, uk, type Locale as DateFnsLocale } from "date-fns/locale";
import type { Locale } from "./config";

// date-fns needs its own locale object for month names and the first day of
// the week (Monday in Ukrainian).
const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { uk, en: enUS };

export function dateFnsLocale(locale: Locale): DateFnsLocale {
  return DATE_FNS_LOCALES[locale];
}
