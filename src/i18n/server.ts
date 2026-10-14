import "server-only";
import {
  createFormatter,
  createTranslator,
  type NamespaceKeys,
  type NestedKeyOf,
} from "use-intl/core";
import { TIME_ZONE } from "./config";
import { dateFnsLocale } from "./dateFns";
import { getLocale } from "./locale";
import { MESSAGES, type Messages } from "./messages";
import { fallbackMessage } from "./fallback";
import { formatDate, type DatePattern } from "./dates";
import { labelFor, type LabelKind, type LabelsTranslator } from "./labels";

export { getLocale };

type Namespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

/** Translations for server components, server actions and route handlers. */
export async function getTranslations<N extends Namespace>(namespace: N) {
  const locale = await getLocale();
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace,
    timeZone: TIME_ZONE,
    getMessageFallback: fallbackMessage,
  });
}

export async function getFormatter() {
  return createFormatter({ locale: await getLocale(), timeZone: TIME_ZONE });
}

export async function getDateFnsLocale() {
  return dateFnsLocale(await getLocale());
}

export async function getFormatDate() {
  const locale = await getLocale();
  return (date: Date | number, pattern: DatePattern) => formatDate(date, pattern, locale);
}

export async function getLabel() {
  const t = (await getTranslations("labels")) as unknown as LabelsTranslator;
  return (kind: LabelKind, item: { value: string; label?: string | null }) => labelFor(t, kind, item);
}
