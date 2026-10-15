import type { DatePattern } from "@/i18n/dates";

// The month-and-year line under a resume entry. English keeps the pattern the
// cards used before translation; Ukrainian takes the standalone short month
// ("січ. 2020").
export const MONTH_YEAR: DatePattern = { en: "MMM yyyy", uk: "LLL yyyy" };
