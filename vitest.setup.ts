import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof global.fetch === "undefined") {
  global.fetch = vi.fn();
}

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

// skillklan i18n (D29). Components take translations from "@/i18n/client" and
// the server reads the locale in "@/i18n/locale"; tests replace both with the
// real dictionaries in a test locale. English by default — the suite asserts on
// English text; a test that checks Ukrainian calls setTestLocale("uk")
// (__tests__/helpers/i18n.ts). The real wiring is tested unmocked in
// __tests__/i18n/.
const i18nTest = vi.hoisted(() => {
  const state = { locale: "en" as "en" | "uk" };
  (globalThis as { __skI18nTest?: typeof state }).__skI18nTest = state;
  return state;
});

vi.mock("@/i18n/client", async () => {
  const { createTranslator, createFormatter } = await import("use-intl/core");
  const { MESSAGES } = await import("@/i18n/messages");
  const { dateFnsLocale } = await import("@/i18n/dateFns");
  const { TIME_ZONE } = await import("@/i18n/config");
  const { fallbackMessage } = await import("@/i18n/fallback");
  const { formatDate } = await import("@/i18n/dates");
  const { labelFor } = await import("@/i18n/labels");
  type DatePattern = import("@/i18n/dates").DatePattern;
  type LabelKind = import("@/i18n/labels").LabelKind;
  return {
    useTranslations: (namespace?: string) =>
      createTranslator({
        locale: i18nTest.locale,
        messages: MESSAGES[i18nTest.locale],
        namespace: namespace as never,
        timeZone: TIME_ZONE,
        getMessageFallback: fallbackMessage,
      }),
    useLocale: () => i18nTest.locale,
    useFormatter: () => createFormatter({ locale: i18nTest.locale, timeZone: TIME_ZONE }),
    useDateFnsLocale: () => dateFnsLocale(i18nTest.locale),
    useFormatDate: () => (date: Date | number, pattern: DatePattern) => formatDate(date, pattern, i18nTest.locale),
    useLabel: () => {
      const t = createTranslator({ locale: i18nTest.locale, messages: MESSAGES[i18nTest.locale], namespace: "labels", timeZone: TIME_ZONE });
      return (kind: LabelKind, item: { value: string; label?: string | null }) => labelFor(t as never, kind, item);
    },
  };
});

vi.mock("@/i18n/locale", () => ({ getLocale: async () => i18nTest.locale }));

afterEach(() => {
  i18nTest.locale = "en";
});
