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
