import { notFound } from "next/navigation";
import { getNotificationFilterOptions, getNotificationList } from "@/actions/notification.actions";
import { NotificationsContainer } from "@/components/notifications/NotificationsContainer";
import { getFeatureFlags } from "@/skillklan/featureFlags";

export default async function NotificationsPage() {
  // Every notification is about an automation run, so they go with the
  // Automations switch (owner 2026-10-18, D75).
  if (!(await getFeatureFlags()).automations) notFound();
  const [list, options] = await Promise.all([
    getNotificationList({ tab: "all" }),
    getNotificationFilterOptions(),
  ]);
  return (
    <div className="col-span-3">
      <NotificationsContainer
        initial={
          list.success && "data" in list && list.data
            ? list.data
            : { items: [], total: 0, counts: { all: 0, unread: 0, errors: 0, runs: 0 } }
        }
        automations={options.success && "data" in options && options.data ? options.data : []}
      />
    </div>
  );
}
