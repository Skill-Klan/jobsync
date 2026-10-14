"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, History, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { toastError, toastSuccess } from "@/lib/toast";
import { useFormatDate, useLocale, useTranslations } from "@/i18n/client";
import type { DatePattern } from "@/i18n/dates";

// "PPp" is what the screen showed before translation; Ukrainian spells it out
// day first with 24-hour time.
const SNAPSHOT_TIME: DatePattern = { en: "PPp", uk: "d MMM yyyy, HH:mm" };

interface PreflightResult {
  manifest: {
    formatVersion: number;
    appVersion: string;
    exportedAt: string;
    sourceEmail: string;
    counts: Record<string, number>;
  };
  emailMatches: boolean;
  targetIsEmpty: boolean;
  targetCounts: Record<string, number>;
}

interface SnapshotInfo {
  id: string;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  sizeBytes: number;
}

// Backup counts are keyed by database model name. English shows that name as
// is; a name with no translation is shown as stored.
function useModelName() {
  const t = useTranslations("settings.data.models");
  return (model: string) => {
    const key = model as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : model;
  };
}

function CountGrid({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations("settings.data");
  const modelName = useModelName();
  const rows = Object.entries(counts).filter(([, n]) => n > 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("nothing")}</p>;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
      {rows.map(([model, n]) => (
        <div key={model} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{modelName(model)}</span>
          <span className="font-medium tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default function DataSettings() {
  const t = useTranslations("settings.data");
  const formatDate = useFormatDate();
  const locale = useLocale();
  const modelName = useModelName();
  const snapshotTime = (iso: string) => formatDate(new Date(iso), SNAPSHOT_TIME);
  // toFixed, with the decimal mark of the user's language.
  const decimal = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      useGrouping: false,
    }).format(n);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/backup/snapshots");
      if (res.ok) setSnapshots((await res.json()) as SnapshotInfo[]);
    } catch {
      // A failed list is not worth a toast — the card just stays empty.
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const runRollback = async () => {
    if (!restoring) return;
    const snapshotId = restoring.id;
    setRestoring(null);
    setBusy(true);
    try {
      const res = await fetch("/api/backup/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, t("toasts.rollbackFailed"));
        return;
      }
      toastSuccess(t("toasts.rollbackDone"), t("toasts.rollbackDoneTitle"));
      await loadSnapshots();
    } catch {
      toastError(t("toasts.unreachable"), t("toasts.rollbackFailed"));
    } finally {
      setBusy(false);
    }
  };

  const destroyed = preflight
    ? Object.entries(preflight.targetCounts).filter(([, n]) => n > 0)
    : [];

  const onSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPreflight(null);
    setSelected(file);
    if (!file) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/backup/import/preflight", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, t("toasts.readFailed"));
        return;
      }
      setPreflight(json as PreflightResult);
    } catch {
      toastError(t("toasts.unreachable"), t("toasts.readFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!selected) return;
    setConfirming(false);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      body.append("confirmWipe", "true");
      const res = await fetch("/api/backup/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, t("toasts.importFailed"));
        return;
      }
      const total = Object.values(json.counts as Record<string, number>).reduce(
        (sum, n) => sum + n,
        0,
      );
      // Naming the snapshot is the whole point of taking one — a safety net
      // the user does not know exists is not a safety net.
      toastSuccess(
        t(json.snapshotPath ? "toasts.importDoneWithSnapshot" : "toasts.importDone", {
          rows: String(total),
          files: String(json.filesWritten),
        }),
        t("toasts.importDoneTitle"),
      );
      setPreflight(null);
      setSelected(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadSnapshots();
    } catch {
      toastError(t("toasts.unreachable"), t("toasts.importFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("export.title")}</CardTitle>
          <CardDescription>{t("export.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.rich("export.contents", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <Button asChild>
            <a href="/api/backup/export" download>
              <Download className="mr-2 h-4 w-4" />
              {t("export.download")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("import.title")}</CardTitle>
          <CardDescription>{t("import.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-file">{t("import.fileLabel")}</Label>
            <Input
              id="backup-file"
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              onChange={onSelect}
              disabled={busy}
            />
          </div>

          {busy && !preflight && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("import.reading")}
            </p>
          )}

          {preflight && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="text-sm">
                <p>
                  {t("import.exported", {
                    date: snapshotTime(preflight.manifest.exportedAt),
                    version: preflight.manifest.appVersion,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("import.sourceAccount", { email: preflight.manifest.sourceEmail })}
                </p>
              </div>

              {!preflight.emailMatches && (
                <p className="rounded-sm bg-destructive/10 p-2 text-sm font-medium text-destructive">
                  {t("import.differentAccount", { email: preflight.manifest.sourceEmail })}
                </p>
              )}

              <div>
                <p className="mb-1 text-sm font-medium">{t("import.contains")}</p>
                <CountGrid counts={preflight.manifest.counts} />
              </div>

              <Button
                variant="destructive"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("import.replace")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">{t("undo.title")}</CardTitle>
            <CardDescription>{t("undo.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{snapshotTime(snapshot.exportedAt)}</p>
                  <p className="text-muted-foreground">
                    {t("undo.snapshot", {
                      jobs: String(snapshot.counts.Job ?? 0),
                      resumes: String(snapshot.counts.Resume ?? 0),
                      size: decimal(snapshot.sizeBytes / 1024 / 1024),
                    })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRestoring(snapshot)}
                >
                  <History className="mr-2 h-4 w-4" />
                  {t("undo.restore")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rollbackDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rollbackDialog.description", {
                date: restoring ? snapshotTime(restoring.exportedAt) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("rollbackDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={runRollback}>
              {t("rollbackDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("importDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t("importDialog.intro")}</p>
                <ul className="list-inside list-disc text-sm">
                  {destroyed.map(([model, n]) => (
                    <li key={model}>
                      {t(
                        new Intl.PluralRules(locale).select(n) === "one"
                          ? "importDialog.item"
                          : "importDialog.itemPlural",
                        { count: String(n), model: modelName(model).toLowerCase() },
                      )}
                    </li>
                  ))}
                  {destroyed.length === 0 && <li>{t("importDialog.empty")}</li>}
                </ul>
                {preflight && !preflight.emailMatches && (
                  <p className="font-medium text-destructive">
                    {t("importDialog.differentAccount")}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("importDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
              onClick={runImport}
            >
              {t("importDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
