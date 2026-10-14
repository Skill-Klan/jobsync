// Switch the locale the mocked i18n hooks and getLocale() use (vitest.setup.ts).
// Reset to English after every test.
export function setTestLocale(locale: "uk" | "en"): void {
  const state = (globalThis as { __skI18nTest?: { locale: "uk" | "en" } }).__skI18nTest;
  if (!state) throw new Error("i18n test state missing — is vitest.setup.ts loaded?");
  state.locale = locale;
}
