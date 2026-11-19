"use client";

import { useId, useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setFeatureEnabled } from "@/actions/featureToggles.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import { useTranslations } from "@/i18n/client";
import { FEATURE_GROUPS, featuresInGroup, type FeatureFlags, type FeatureKey } from "@/skillklan/features";

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("features.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("features.description")}</p>
      </div>
      {/* Grouped, one line each; the long text opens on request. */}
      {FEATURE_GROUPS.map((group) => {
        const keys = featuresInGroup(group);
        const on = keys.filter((key) => flags[key]).length;
        return (
          <section key={group} aria-labelledby={`${baseId}-group-${group}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h4 id={`${baseId}-group-${group}`} className="text-sm font-semibold">
                {t(`features.groups.${group}`)}
              </h4>
              <span className="text-xs text-muted-foreground">
                {t("features.enabledCount", { on, total: keys.length })}
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {keys.map((key) => {
                const id = `${baseId}-${key}`;
                return (
                  <li key={key} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <label htmlFor={id} className="text-sm font-medium">
                        {t(`features.items.${key}.label`)}
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {t(`features.items.${key}.summary`)}
                      </p>
                      <details className="text-sm text-muted-foreground">
                        <summary className="w-fit cursor-pointer text-xs underline-offset-2 hover:underline">
                          {t("features.details")}
                        </summary>
                        <p className="mt-1">{t(`features.items.${key}.description`)}</p>
                      </details>
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
          </section>
        );
      })}
    </div>
  );
}
