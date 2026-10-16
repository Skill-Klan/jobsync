"use client";

import { useId, useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setFeatureEnabled } from "@/actions/featureToggles.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import { useTranslations } from "@/i18n/client";
import { FEATURE_KEYS, type FeatureFlags, type FeatureKey } from "@/skillklan/features";

// Settings → «Функції»: the SkillKlan feature switches (src/skillklan/features.ts).
// Rendered for admins only (the settings page decides); the change itself is
// checked again on the server.
export default function FeatureSettings({ initial }: { initial: FeatureFlags }) {
  const t = useTranslations("settings");
  const [flags, setFlags] = useState(initial);
  const [pending, setPending] = useState<FeatureKey | null>(null);
  const [, startTransition] = useTransition();
  const baseId = useId();

  const change = (key: FeatureKey, enabled: boolean) => {
    const before = flags;
    setFlags({ ...flags, [key]: enabled });
    setPending(key);
    startTransition(async () => {
      const result = await setFeatureEnabled(key, enabled).catch(() => null);
      setPending(null);
      if (result?.success) {
        setFlags(result.data);
        toastSuccess(t("features.saved"));
      } else {
        // Not saved — the switch goes back to what everyone still sees.
        setFlags(before);
        toastError(result?.message ?? t("features.saveFailed"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{t("features.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("features.description")}</p>
      </div>
      <ul className="divide-y rounded-md border">
        {FEATURE_KEYS.map((key) => {
          const id = `${baseId}-${key}`;
          return (
            <li key={key} className="flex items-start justify-between gap-4 p-4">
              <div className="space-y-1">
                <label htmlFor={id} className="text-sm font-medium">
                  {t(`features.items.${key}.label`)}
                </label>
                <p className="text-sm text-muted-foreground">
                  {t(`features.items.${key}.description`)}
                </p>
              </div>
              <Switch
                id={id}
                checked={flags[key]}
                disabled={pending !== null}
                onCheckedChange={(enabled) => change(key, enabled)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
