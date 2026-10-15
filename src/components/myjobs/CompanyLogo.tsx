"use client";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/client";

// Falls back to the app mark both when the company has no logo and when the
// stored URL 404s; onerror is cleared first so a broken fallback can't loop.
export function CompanyLogo({
  logoUrl,
  className,
}: {
  logoUrl?: string | null;
  className?: string;
}) {
  const t = useTranslations("jobs");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={t("ui.companyLogo")}
      className={cn("rounded-md object-cover", className)}
      src={logoUrl || "/images/jobsync-logo.svg"}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/images/jobsync-logo.svg";
      }}
    />
  );
}
