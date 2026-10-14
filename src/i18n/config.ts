// SkillKlan Job speaks Ukrainian by default and switches to English on
// request (owner decision D29). The choice lives in a cookie — addresses
// carry no /uk or /en.
export const LOCALES = ["uk", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uk";
export const LOCALE_COOKIE = "sk_locale";
export const TIME_ZONE = "Europe/Kyiv";

/** What the switcher shows — each language in its own name. */
export const LOCALE_NAMES: Record<Locale, string> = {
  uk: "Українська",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Anything that is not a supported locale — no cookie, a stale or forged one — is Ukrainian. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
