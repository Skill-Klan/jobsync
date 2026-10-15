"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import packageJson from "../../package.json";
import { useTranslations } from "@/i18n/client";

const BRAND = "SkillKlan Job";
const BRAND_URL = "https://jobs.skillklan.com.ua";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// skillklan: no upstream links, star prompt or update check — this app is developed
// independently. The JobSync attribution stays: it is a condition of the MIT license.
export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const t = useTranslations("common");
  const appVersion = packageJson.version;
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("support.title")}</DialogTitle>
          <DialogDescription>{t("support.about", { brand: BRAND })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("support.version")}</h3>
            <p className="text-sm text-muted-foreground">v{appVersion}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("support.copyright")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("support.license", { year: String(currentYear), brand: BRAND })}
            </p>
            <a
              href={BRAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {BRAND}
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
