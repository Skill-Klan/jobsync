import { useCallback } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "@/i18n/client";
import { hasMinResumeSections, MIN_SECTIONS } from "@/lib/resumeSections";

export { hasMinResumeSections };

export type InsufficientSectionsAction = "setDefault" | "copy";

export function useWarnInsufficientResumeSections() {
  const t = useTranslations("common");
  return useCallback(
    (action: InsufficientSectionsAction) =>
      toastError(
        t(`resumeSections.notEnough.${action}`, MIN_SECTIONS),
        t("resumeSections.notEnoughTitle"),
      ),
    [t],
  );
}
