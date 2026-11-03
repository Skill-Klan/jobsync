"use client";

import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addCatalogItem,
  approveCatalogItemRequest,
  rejectCatalogItemRequest,
  removeCatalogItem,
  renameCatalogItem,
} from "@/actions/catalog.actions";
import { CATALOG_KINDS, type CatalogEntryView, type CatalogKind } from "@/skillklan/catalog/kinds";
import type { CatalogRequestView } from "@/skillklan/catalog/catalog";
import { useTranslations } from "@/i18n/client";
import { toastError, toastSuccess } from "@/lib/toast";

type Tab = "requests" | CatalogKind;

// «Каталог»: the one list everybody picks from in the job form, and the
// requests of students for what it lacks. The admin's own page — the role is
// checked again on the server for every change.
export default function CatalogAdmin({
  entries: initialEntries,
  requests: initialRequests,
}: {
  entries: CatalogEntryView[];
  requests: CatalogRequestView[];
}) {
  const t = useTranslations("catalog");
  const [tab, setTab] = useState<Tab>(initialRequests.length > 0 ? "requests" : "skill");
  const [entries, setEntries] = useState(initialEntries);
  const [requests, setRequests] = useState(initialRequests);
  const [removing, setRemoving] = useState<CatalogEntryView | null>(null);
  const [busy, startTransition] = useTransition();

  const done = (message: string) => toastSuccess(message);

  const add = (kind: CatalogKind, label: string, reset: () => void) =>
    startTransition(async () => {
      const result = await addCatalogItem(kind, label).catch(() => null);
      if (result?.success) {
        setEntries((prev) => [...prev, result.data].sort((a, b) => a.label.localeCompare(b.label)));
        reset();
        done(t("added"));
      } else toastError(result?.message ?? t("errors.failed"));
    });

  const rename = (entry: CatalogEntryView, label: string, close: () => void) =>
    startTransition(async () => {
      const result = await renameCatalogItem(entry.id, label).catch(() => null);
      if (result?.success) {
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? result.data : e)).sort((a, b) => a.label.localeCompare(b.label)));
        close();
        done(t("renamed"));
      } else toastError(result?.message ?? t("errors.failed"));
    });

  const remove = (entry: CatalogEntryView) => {
    setRemoving(null);
    startTransition(async () => {
      const result = await removeCatalogItem(entry.id).catch(() => null);
      if (result?.success) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        done(t("removed"));
      } else toastError(result?.message ?? t("errors.failed"));
    });
  };

  const approve = (request: CatalogRequestView, label: string) =>
    startTransition(async () => {
      const result = await approveCatalogItemRequest(request.id, label).catch(() => null);
      if (result?.success) {
        // every pending request for the same thing is closed with it
        setRequests((prev) => prev.filter((r) => !(r.kind === request.kind && r.label.toLowerCase() === request.label.toLowerCase())));
        setEntries((prev) => (prev.some((e) => e.id === result.data.id) ? prev : [...prev, result.data].sort((a, b) => a.label.localeCompare(b.label))));
        done(t("requests.approved"));
      } else toastError(result?.message ?? t("errors.failed"));
    });

  const reject = (request: CatalogRequestView) =>
    startTransition(async () => {
      const result = await rejectCatalogItemRequest(request.id).catch(() => null);
      if (result?.success) {
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        done(t("requests.rejected"));
      } else toastError(result?.message ?? t("errors.failed"));
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-2xl font-semibold leading-none tracking-tight">{t("page.title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("page.description")}</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {(["requests", ...CATALOG_KINDS] as Tab[]).map((name) => (
          <Button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            size="sm"
            variant={tab === name ? "default" : "outline"}
            onClick={() => setTab(name)}
          >
            {t(`tabs.${name}`)}
            {name === "requests" && requests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {requests.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {tab === "requests" ? (
        <RequestsList requests={requests} busy={busy} onApprove={approve} onReject={reject} />
      ) : (
        <KindList
          kind={tab}
          entries={entries.filter((e) => e.kind === tab)}
          busy={busy}
          onAdd={add}
          onRename={rename}
          onRemove={setRemoving}
        />
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{removing && t("removeText", { label: removing.label })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => removing && remove(removing)}
            >
              {t("removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KindList({
  kind,
  entries,
  busy,
  onAdd,
  onRename,
  onRemove,
}: {
  kind: CatalogKind;
  entries: CatalogEntryView[];
  busy: boolean;
  onAdd: (kind: CatalogKind, label: string, reset: () => void) => void;
  onRename: (entry: CatalogEntryView, label: string, close: () => void) => void;
  onRemove: (entry: CatalogEntryView) => void;
}) {
  const t = useTranslations("catalog");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onAdd(kind, draft, () => setDraft(""));
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("add.placeholder")}
          aria-label={t("add.placeholder")}
          className="max-w-sm"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          {t("add.button")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">{t("count", { count: entries.length })}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              {editing?.id === entry.id ? (
                <form
                  className="flex flex-1 flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(entry, editing.label, () => setEditing(null));
                  }}
                >
                  <Input
                    value={editing.label}
                    onChange={(e) => setEditing({ id: entry.id, label: e.target.value })}
                    aria-label={t("renameLabel")}
                    className="max-w-sm"
                    autoFocus
                  />
                  <Button type="submit" size="sm" disabled={busy || !editing.label.trim()}>
                    {t("save")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                    {t("cancel")}
                  </Button>
                </form>
              ) : (
                <>
                  <span>{entry.label}</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={`${t("rename")}: ${entry.label}`}
                      onClick={() => setEditing({ id: entry.id, label: entry.label })}
                    >
                      {t("rename")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={`${t("remove")}: ${entry.label}`}
                      onClick={() => onRemove(entry)}
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestsList({
  requests,
  busy,
  onApprove,
  onReject,
}: {
  requests: CatalogRequestView[];
  busy: boolean;
  onApprove: (request: CatalogRequestView, label: string) => void;
  onReject: (request: CatalogRequestView) => void;
}) {
  const t = useTranslations("catalog");
  const [labels, setLabels] = useState<Record<string, string>>({});

  if (requests.length === 0) return <p className="text-sm text-muted-foreground">{t("requests.empty")}</p>;
  return (
    <ul className="divide-y rounded-md border bg-background">
      {requests.map((request) => {
        const label = labels[request.id] ?? request.label;
        return (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{t(`kinds.${request.kind}`)}</Badge>
                <span>{t("requests.from", { name: request.requesterName || "—" })}</span>
              </div>
              <Input
                value={label}
                onChange={(e) => setLabels((prev) => ({ ...prev, [request.id]: e.target.value }))}
                aria-label={t("requests.editLabel")}
                className="max-w-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy || !label.trim()} onClick={() => onApprove(request, label)}>
                {t("requests.approve")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onReject(request)}>
                {t("requests.reject")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
