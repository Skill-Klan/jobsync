"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ImportResult, Preview } from "@/skillklan/plans/importFlow";
import { useTranslations } from "@/i18n/client";
import { toastError } from "@/lib/toast";

// «Імпорт з таблиці» (SKD-60), the admin's: send the school's workbook, look at
// which student each tab goes to and what would be ticked, then confirm. The
// preview writes nothing; the file is sent again with the confirmation and is
// never kept (the server checks everything again).
// One step of the import: the route answers like a server action did.
async function send<T>(data: FormData): Promise<{ success: true; data: T } | { success: false; message?: string } | null> {
  try {
    return await (await fetch("/api/plans/import", { method: "POST", body: data })).json();
  } catch {
    return null;
  }
}

export default function PlanImport({ tracks }: { tracks: { track: string; title: string }[] }) {
  const t = useTranslations("plans");
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState(tracks[0]?.track ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [chosen, setChosen] = useState<Record<string, number | null>>({});
  const [report, setReport] = useState<ImportResult[] | null>(null);
  // A new key empties the (uncontrolled) file input on reset.
  const [fileKey, setFileKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setFile(null);
    setFileKey((k) => k + 1);
    setPreview(null);
    setChosen({});
    setReport(null);
  };

  const body = (mode: "preview" | "apply", extra?: Record<string, string>) => {
    const data = new FormData();
    data.set("mode", mode);
    if (file) data.set("file", file);
    data.set("track", track);
    for (const [k, v] of Object.entries(extra ?? {})) data.set(k, v);
    return data;
  };

  const read = () => {
    if (!file) return toastError(t("import.noFile"));
    startTransition(async () => {
      const result = await send<Preview>(body("preview"));
      if (!result?.success) return toastError(result?.message ?? t("import.unreadable"));
      setPreview(result.data);
      // A student goes to one tab only: when two tabs preselect the same one, the later is left for the admin.
      const taken = new Set<number>();
      setChosen(
        Object.fromEntries(
          result.data.tabs.map((x) => {
            const free = x.preselected !== null && !taken.has(x.preselected);
            if (free) taken.add(x.preselected as number);
            return [x.tab, free ? x.preselected : null];
          }),
        ),
      );
    });
  };

  const picks = Object.entries(chosen).flatMap(([tab, userId]) => (userId === null ? [] : [{ tab, userId }]));

  const confirm = () => {
    if (picks.length === 0) return toastError(t("import.nothingChosen"));
    const clash = picks.find((p, i) => picks.findIndex((q) => q.userId === p.userId) !== i);
    if (clash) return toastError(t("import.sameStudent", { tab: clash.tab }));
    startTransition(async () => {
      const result = await send<{ results: ImportResult[] }>(body("apply", { picks: JSON.stringify(picks) }));
      if (!result?.success) return toastError(result?.message);
      setReport(result.data.results);
    });
  };

  const stateOf = (tab: Preview["tabs"][number]) =>
    tab.plan ? t("import.statePlan", { done: tab.alreadyDone }) : tab.account ? t("import.stateAccount") : t("import.stateNew");

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("import.open")}
      </Button>
    );
  }

  return (
    <section className="space-y-4 rounded-md border p-4" aria-label={t("import.title")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("import.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("import.intro")}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }}>
          {t("import.close")}
        </Button>
      </div>

      {report ? (
        <div className="space-y-2">
          <h3 className="font-medium">{t("import.reportTitle")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {report.map((r) => (
              <li key={r.tab}>
                {r.ok
                  ? t("import.reportRow", {
                      name: r.name,
                      marked: r.marked,
                      account: r.accountCreated ? t("import.reportAccount") : "",
                      plan: r.planCreated ? t("import.reportPlan") : "",
                      missing: r.missing > 0 ? t("import.reportMissing", { count: r.missing }) : "",
                    })
                  : t("import.reportFailed", { name: r.name })}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            {t("import.again")}
          </Button>
        </div>
      ) : !preview ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block">{t("import.track")}</span>
            <select className="h-9 rounded-md border bg-background px-2" value={track} onChange={(e) => setTrack(e.target.value)}>
              {tracks.map((x) => (
                <option key={x.track} value={x.track}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block">{t("import.file")}</span>
            <input
              key={fileKey}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="button" disabled={pending || !file} onClick={read}>
            {pending ? t("import.previewing") : t("import.preview")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2">{t("import.tab")}</th>
                  <th className="p-2">{t("import.student")}</th>
                  <th className="p-2">{t("import.passed")}</th>
                  <th className="p-2">{t("import.willMark")}</th>
                  <th className="p-2">{t("import.state")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.tabs.map((row) => (
                  <tr key={row.tab}>
                    <td className="p-2 font-medium">{row.tab}</td>
                    <td className="p-2">
                      {row.candidates.length === 0 ? (
                        <span className="text-muted-foreground">{t("import.noCandidates")}</span>
                      ) : (
                        <select
                          aria-label={`${t("import.student")}: ${row.tab}`}
                          className="h-9 rounded-md border bg-background px-2"
                          value={chosen[row.tab] ?? ""}
                          onChange={(e) => setChosen((prev) => ({ ...prev, [row.tab]: e.target.value === "" ? null : Number(e.target.value) }))}
                        >
                          <option value="">{t("import.skip")}</option>
                          {row.candidates.map((c) => (
                            <option key={c.userId} value={c.userId}>
                              {c.mentors.length > 0 ? `${c.name} · ${c.mentors.join(", ")}` : c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-2">{row.passed}</td>
                    <td className="p-2">
                      {row.willMark}
                      {row.missing.length > 0 && (
                        <div className="text-xs text-muted-foreground">{t("import.missing", { count: row.missing.length })}</div>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{stateOf(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.skipped.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("import.skippedTitle", { names: preview.skipped.map((s) => s.tab).join(", ") })}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" disabled={pending || picks.length === 0} onClick={confirm}>
              {pending ? t("import.confirming") : t("import.confirm", { count: picks.length })}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={reset}>
              {t("import.again")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
