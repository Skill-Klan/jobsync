"use client";
import { useTransition } from "react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./ui/dropdown-menu";
import { setLocale } from "@/i18n/actions";
import { useLocale, useTranslations } from "@/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";

// Language items of the user menu. The server action stores the choice in a
// cookie; a cookie set by a server action makes Next.js re-render the page,
// so every server and client text switches at once.
export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t("language")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={locale}
        onValueChange={(next) => {
          if (next === locale) return;
          startTransition(async () => {
            await setLocale(next);
          });
        }}
      >
        {LOCALES.map((l) => (
          <DropdownMenuRadioItem key={l} value={l} lang={l} disabled={isPending} className="cursor-pointer">
            {LOCALE_NAMES[l]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

// The same choice as plain buttons, for the phone menu (owner 2026-11-20):
// there is no user menu on a phone, and dropdown items don't work outside one.
export function LocaleButtons({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className={className}>
      <span className="text-sm font-normal text-muted-foreground">{t("language")}</span>
      <div className="mt-2 flex gap-2">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={l === locale}
            disabled={isPending}
            onClick={() => {
              if (l === locale) return;
              startTransition(async () => {
                await setLocale(l);
              });
            }}
            className={
              l === locale
                ? "rounded-md border border-primary px-3 py-1 text-base text-foreground"
                : "rounded-md border px-3 py-1 text-base text-muted-foreground hover:text-foreground"
            }
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
