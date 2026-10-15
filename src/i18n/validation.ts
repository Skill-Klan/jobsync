import { createTranslator, type MessageKeys, type NestedKeyOf } from "use-intl/core";
import { z } from "zod";
import enValidation from "./messages/en/validation.json";
import ukValidation from "./messages/uk/validation.json";
import { TIME_ZONE, type Locale } from "./config";

// Form validation messages in the language of the page: the ones our schemas
// carry (src/models) and the ones zod writes itself for a field that has none.
//
// Schemas are module-level constants checked outside React, so the language
// comes from <html lang> (set by the root layout) at the moment a value is
// checked, not when a module loads: a schema's message is a function,
// `{ error: () => vt("…") }`, and a language switch applies without a reload.
// No DOM — the server — means English: the server only re-checks what the
// form has already checked; zod's own defaults stay technical there. Only the two small `validation` dictionaries are
// imported, not the whole app's messages.

type ValidationMessages = typeof enValidation;
export type ValidationKey = MessageKeys<ValidationMessages, NestedKeyOf<ValidationMessages>>;

const DICTIONARIES: Record<Locale, ValidationMessages> = { en: enValidation, uk: ukValidation };

/** The language of the page: Ukrainian only when <html lang="uk">. */
export function pageLocale(): Locale {
  return typeof document !== "undefined" && document.documentElement.lang === "uk" ? "uk" : "en";
}

const translators = {
  en: createTranslator({
    locale: "en",
    messages: { validation: DICTIONARIES.en },
    namespace: "validation",
    timeZone: TIME_ZONE,
  }),
  uk: createTranslator({
    locale: "uk",
    messages: { validation: DICTIONARIES.uk },
    namespace: "validation",
    timeZone: TIME_ZONE,
  }),
};

/** A validation message in the page's language, e.g. vt("fields.jobTitle.min", { min: 2 }). */
export function vt(key: ValidationKey, values?: Record<string, string | number>): string {
  return translators[pageLocale()](key, values);
}

const EMPTY = new Set<unknown>([undefined, null, ""]);

// The server keeps zod's own English: "expected string, received undefined"
// is what a log, the backup import error and the AI tools need. Only a page,
// where a person reads it under a form field, gets the plain words below.
const zodEnglish = z.locales.en().localeError;

// zod's own messages, for a field without one of ours. On a page: plain words
// instead of zod's "Too small: expected string to have >=1 characters"; zod's
// built-in Ukrainian (z.locales.uk) is not used — it reads «string матиме >=1
// символів».
function defaultMessage(issue: z.core.$ZodRawIssue): ReturnType<typeof zodEnglish> {
  if (typeof document === "undefined") return zodEnglish(issue);
  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "string") {
        return min <= 1 ? vt("defaults.required") : vt("defaults.string.min", { min });
      }
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return issue.inclusive === false
          ? vt("defaults.number.greaterThan", { min })
          : vt("defaults.number.min", { min });
      }
      return vt("defaults.invalid");
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "string") return vt("defaults.string.max", { max });
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return issue.inclusive === false
          ? vt("defaults.number.lessThan", { max })
          : vt("defaults.number.max", { max });
      }
      return vt("defaults.invalid");
    }
    case "invalid_type":
      return EMPTY.has(issue.input) ? vt("defaults.required") : vt("defaults.invalid");
    case "invalid_format":
      if (issue.format === "email") return vt("defaults.email");
      if (issue.format === "url") return vt("defaults.url");
      return vt("defaults.format");
    case "invalid_value":
      return vt("defaults.option");
    default:
      return vt("defaults.invalid");
  }
}

// Installed once, by whichever schema is imported first — every schema file
// imports vt from here.
z.config({ localeError: defaultMessage });
