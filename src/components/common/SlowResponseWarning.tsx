"use client";
import { Clock } from "lucide-react";
import { useTranslations } from "@/i18n/client";

export const SlowResponseWarning = () => {
  const t = useTranslations("common");
  return (
    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 animate-in fade-in duration-500">
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        {t.rich("slowResponse", {
          settings: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </span>
    </div>
  );
};
