import { format } from "date-fns";
import { createTranslator } from "use-intl/core";
import { useLocale, useTranslations } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { formatDate, type DatePattern } from "@/i18n/dates";
import type { Messages } from "@/i18n/messages";
import enSettings from "@/i18n/messages/en/settings.json";
import {
  AI_PROVIDER_LABELS,
  type AiCallStatus,
  type AiFailureStatus,
} from "@/models/aiUsage.model";

// The words and number style of one language. The helpers below default to
// English — what the screen said before translation — so they stay pure and
// callable without a React tree; components pass the user's own.
export type UsageText = {
  t: ReturnType<typeof createTranslator<Messages, "settings.usage">>;
  locale: Locale;
};

export const ENGLISH_USAGE: UsageText = {
  locale: "en",
  // Only the settings namespace is read, so only it is bundled here.
  t: createTranslator({
    locale: "en",
    messages: { settings: enSettings } as Messages,
    namespace: "settings.usage",
  }),
};

export function useUsageText(): UsageText {
  return { t: useTranslations("settings.usage"), locale: useLocale() };
}

/** toFixed(digits) with the decimal mark of the language. */
export function formatDecimal(n: number, digits: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(n);
}

export function formatTokens(n: number, locale: Locale = "en"): string {
  // 999,600 would round to "1000K"; switch to M before that happens.
  if (n >= 999_500) return `${formatDecimal(n / 1_000_000, 2, locale)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatCount(n: number | null, locale: Locale = "en"): string {
  return n === null ? "—" : n.toLocaleString(locale);
}

export function formatSeconds(ms: number | null, text: UsageText = ENGLISH_USAGE): string {
  if (ms === null) return "—";
  return text.t("time.seconds", { value: formatDecimal(ms / 1000, 1, text.locale) });
}

const CALL_DAY: DatePattern = { en: "MMM d HH:mm", uk: "d MMM HH:mm" };

// Compares against the passed now, not date-fns' isToday, which reads the
// real clock and so can't be tested.
export function formatCallTime(
  date: Date,
  now: Date = new Date(),
  text: UsageText = ENGLISH_USAGE,
): string {
  const time = format(date, "HH:mm");
  if (format(now, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")) {
    return text.t("time.today", { time });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (format(yesterday, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")) {
    return text.t("time.yesterday", { time });
  }
  return formatDate(date, CALL_DAY, text.locale);
}

export function formatChange(
  calls: number,
  previous: number,
): { text: string; up: boolean } | null {
  if (previous === 0) return null;
  const pct = Math.round(((calls - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, up: pct > 0 };
}

export function providerLabel(provider: string): string {
  return AI_PROVIDER_LABELS[provider] ?? provider;
}

// Hand-picked like the dashboard charts: dark values are the design's.
export const PROVIDER_COLORS: Record<
  "light" | "dark",
  Record<string, string>
> = {
  dark: {
    ollama: "#60A5FA",
    deepseek: "#F59E0B",
    openai: "#14B8A6",
    gemini: "#C4B5FD",
    openrouter: "#F472B6",
  },
  light: {
    ollama: "#2563EB",
    deepseek: "#D97706",
    openai: "#0D9488",
    gemini: "#7C3AED",
    openrouter: "#DB2777",
  },
};

export const FALLBACK_PROVIDER_COLOR = "#94A3B8";

// label: a key under settings.usage.
export const STATUS_META: Record<
  AiCallStatus,
  {
    label: `statuses.${"ok" | "truncated" | "error" | "timedOut" | "interrupted" | "stopped"}`;
    className: string;
  }
> = {
  ok: {
    label: "statuses.ok",
    className:
      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  },
  truncated: {
    label: "statuses.truncated",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  error: {
    label: "statuses.error",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  timed_out: {
    label: "statuses.timedOut",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  interrupted: {
    label: "statuses.interrupted",
    className: "bg-muted text-muted-foreground",
  },
  stopped: { label: "statuses.stopped", className: "bg-muted text-muted-foreground" },
};

// label and description: keys under settings.usage.failures.
type FailureKey = "error" | "timedOut" | "truncated" | "interrupted";
export const FAILURE_META: Record<
  AiFailureStatus,
  { label: FailureKey; description: `${FailureKey}Description`; dotClassName: string }
> = {
  error: {
    label: "error",
    description: "errorDescription",
    dotClassName: "bg-red-400",
  },
  timed_out: {
    label: "timedOut",
    description: "timedOutDescription",
    dotClassName: "bg-orange-400",
  },
  truncated: {
    label: "truncated",
    description: "truncatedDescription",
    dotClassName: "bg-amber-400",
  },
  interrupted: {
    label: "interrupted",
    description: "interruptedDescription",
    dotClassName: "bg-slate-400",
  },
};

/** A feature's name in the user's language; an unknown one as stored. */
export function featureLabel(feature: string, text: UsageText): string {
  const key = `features.${feature}` as Parameters<UsageText["t"]>[0];
  return text.t.has(key) ? text.t(key) : feature;
}
