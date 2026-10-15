"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveCardHeader } from "@/components/ResponsiveCardHeader";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import { useNotifications } from "@/context/NotificationContext";
import {
  clearReadNotifications,
  deleteNotification,
  getNotificationList,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notification.actions";
import type { NotificationItem, NotificationTab } from "@/models/notification.model";
import { NotificationRow } from "./NotificationRow";
import { groupByDay, isErrorNotification, useNotificationText } from "./notificationDisplay";

type Counts = Record<NotificationTab, number>;
type PendingDelete = { kind: "clear" } | { kind: "delete"; id: string };

interface NotificationsContainerProps {
  initial: { items: NotificationItem[]; total: number; counts: Counts };
  automations: { id: string; name: string }[];
}

const TAB_IDS: NotificationTab[] = ["all", "unread", "errors", "runs"];
const ALL_AUTOMATIONS = "all";

export function NotificationsContainer({ initial, automations }: NotificationsContainerProps) {
  const text = useNotificationText();
  const { t } = text;
  const { refresh } = useNotifications();
  const [rawTab, setTab] = useTabQueryParam(TAB_IDS, "all");
  const tab = rawTab as NotificationTab;
  const [automationId, setAutomationId] = useState<string | undefined>();
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [counts, setCounts] = useState(initial.counts);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  // Drops a response that a newer tab or filter pick has overtaken.
  const requestId = useRef(0);

  const query = async (which: NotificationTab, automation: string | undefined, skip: number) => {
    const id = ++requestId.current;
    setLoading(true);
    const res = await getNotificationList({ tab: which, automationId: automation, skip });
    if (id !== requestId.current) return;
    setLoading(false);
    if (!res.success || !("data" in res) || !res.data) return;
    const data = res.data;
    setItems((prev) => {
      if (skip === 0) return data.items;
      // Rows can shift between pages as runs land; never show one twice.
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
    });
    setTotal(data.total);
    setCounts(data.counts);
  };

  // Follows ?tab=, so a deep link or a same-route link that resets it re-queries.
  const shownTab = useRef<NotificationTab>("all");
  useEffect(() => {
    if (tab === shownTab.current) return;
    shownTab.current = tab;
    query(tab, automationId, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Resyncs after an optimistic update the server rejected.
  const failed = (res: { success: boolean; message?: string }) => {
    if (res.success) return false;
    toastError(res.message);
    query(tab, automationId, 0);
    return true;
  };

  const onAutomationChange = (value: string) => {
    const next = value === ALL_AUTOMATIONS ? undefined : value;
    setAutomationId(next);
    query(tab, next, 0);
  };

  const onRemove = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((n) => n - 1);
    setCounts((c) => ({
      all: c.all - 1,
      unread: c.unread - (item.readAt === null ? 1 : 0),
      errors: c.errors - (isErrorNotification(item) ? 1 : 0),
      runs: c.runs - (isErrorNotification(item) ? 0 : 1),
    }));
    if (failed(await deleteNotification(id))) return;
    refresh();
  };

  const onOpenLink = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.readAt === null) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, readAt: new Date() } : i)));
      setCounts((c) => ({ ...c, unread: c.unread - 1 }));
    }
    if (failed(await markNotificationRead(id))) return;
    refresh();
  };

  const onMarkAll = async () => {
    if (failed(await markAllNotificationsRead())) return;
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date() })));
    setCounts((c) => ({ ...c, unread: 0 }));
    refresh();
  };

  // Read rows beyond the loaded page are deleted too, so re-read the counts.
  const onClearRead = async () => {
    if (failed(await clearReadNotifications())) return;
    setItems((prev) => prev.filter((i) => i.readAt === null));
    refresh();
    await query(tab, automationId, 0);
  };

  const onConfirmDelete = () => {
    if (pending?.kind === "clear") onClearRead();
    else if (pending?.kind === "delete") onRemove(pending.id);
    setPending(null);
  };

  const groups = groupByDay(items, undefined, text);

  return (
    <Card>
      <ResponsiveCardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>{t("page.title")}</CardTitle>
          <CardDescription>{t("page.description")}</CardDescription>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onMarkAll}>
            <CheckCheck className="h-4 w-4" />
            {t("page.markAllRead")}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPending({ kind: "clear" })}>
            <Trash2 className="h-4 w-4" />
            {t("page.clearRead")}
          </Button>
        </div>
      </ResponsiveCardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 border-b sm:flex-row sm:items-end sm:justify-between">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {TAB_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm",
                  tab === id
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground",
                )}
              >
                {t(`tabs.${id}`)}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold",
                    id === "errors" && counts.errors > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[id]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            <span className="text-sm text-muted-foreground">{t("page.automation")}</span>
            <Select value={automationId ?? ALL_AUTOMATIONS} onValueChange={onAutomationChange}>
              <SelectTrigger className="h-8 w-[200px]" aria-label={t("page.automation")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_AUTOMATIONS}>{t("page.allAutomations")}</SelectItem>
                {automations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">{t("page.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("page.emptyDescription")}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="pt-4">
              <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h3>
              <ul className="flex flex-col divide-y">
                {g.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    variant="page"
                    onRemove={(id) => setPending({ kind: "delete", id })}
                    onOpenLink={onOpenLink}
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        {items.length < total && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => query(tab, automationId, items.length)}
            >
              {t("page.loadMore")}
            </Button>
          </div>
        )}

        <p className="pt-6 text-center text-xs text-muted-foreground">
          {t("page.retention")}
        </p>
      </CardContent>
      <DeleteAlertDialog
        pageTitle={t("page.deleteItem")}
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onDelete={onConfirmDelete}
        alertTitle={
          pending?.kind === "clear" ? t("page.deleteReadTitle") : t("page.deleteOneTitle")
        }
        alertDescription={
          pending?.kind === "clear"
            ? t("page.deleteReadDescription")
            : t("page.deleteOneDescription")
        }
      />
    </Card>
  );
}
