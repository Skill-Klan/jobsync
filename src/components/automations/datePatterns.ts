import type { DatePattern } from "@/i18n/dates";

// Date patterns the Automations screens show that are not in DATE_PATTERNS.
// `en` is the pattern the screen used before translation; Ukrainian puts the
// day first and uses 24-hour time.
export const AUTOMATION_DATE_PATTERNS = {
  dayTime: { en: "MMM d, h:mm a", uk: "d MMM, HH:mm" },
  dayTimeSeconds: { en: "MMM d, h:mm:ss a", uk: "d MMM, HH:mm:ss" },
  dateAtTime: { en: "MMM d, yyyy 'at' h:mm a", uk: "d MMM yyyy 'о' HH:mm" },
} satisfies Record<string, DatePattern>;
