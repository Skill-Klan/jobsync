"use client";
import { IntlProvider } from "use-intl";
import { TIME_ZONE, type Locale } from "./config";
import { fallbackMessage } from "./fallback";
import type { Messages } from "./messages";

export function IntlClientProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    <IntlProvider
      locale={locale}
      messages={messages}
      timeZone={TIME_ZONE}
      getMessageFallback={fallbackMessage}
    >
      {children}
    </IntlProvider>
  );
}
