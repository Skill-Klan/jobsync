"use client";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">{t("notFound.title")}</h3>
      <p className="text-muted-foreground mt-2">{t("notFound.body")}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/dashboard">{t("notFound.back")}</Link>
      </Button>
    </div>
  );
}
