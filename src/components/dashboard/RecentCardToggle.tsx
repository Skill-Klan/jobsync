"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import { cn } from "@/lib/utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { usePersistedTabIndex } from "@/hooks/usePersistedTabIndex";
import { useActivity } from "@/context/ActivityContext";
import { useActivitySwitchConfirm } from "@/hooks/useActivitySwitchConfirm";
import { JobResponse } from "@/models/job.model";
import { CirclePlay } from "lucide-react";
import Link from "next/link";
import { useFormatDate, useLabel, useTranslations } from "@/i18n/client";
import type { DatePattern } from "@/i18n/dates";

type RecentActivity = {
  id: string;
  activityName: string;
  duration: number | null;
  endTime: Date | null;
  activityType: { label: string } | null;
};

interface RecentCardToggleProps {
  jobs: JobResponse[];
  activities: RecentActivity[];
}

// Day headers: "Wed October 14, 2026" / "ср, 14 жовтня 2026".
const GROUP_DATE: DatePattern = { en: "EEE MMMM d, yyyy", uk: "EEEEEE, d MMMM yyyy" };

type Text = {
  date: (d: Date) => string;
  noDate: string;
  inProgress: string;
};

function groupJobsByDate(jobs: JobResponse[], text: Text) {
  const groups = new Map<string, JobResponse[]>();
  for (const job of jobs) {
    const key = job.appliedDate ? text.date(job.appliedDate) : text.noDate;
    const existing = groups.get(key);
    if (existing) {
      existing.push(job);
    } else {
      groups.set(key, [job]);
    }
  }
  return Array.from(groups.entries());
}

function groupActivitiesByDate(activities: RecentActivity[], text: Text) {
  const groups = new Map<string, RecentActivity[]>();
  for (const activity of activities) {
    const key = activity.endTime ? text.date(activity.endTime) : text.inProgress;
    const existing = groups.get(key);
    if (existing) {
      existing.push(activity);
    } else {
      groups.set(key, [activity]);
    }
  }
  return Array.from(groups.entries());
}

// Stable tab ids — what the chosen tab is remembered by; labels are translated.
const tabs = ["Jobs", "Activities"] as const;

export default function RecentCardToggle({
  jobs,
  activities,
}: RecentCardToggleProps) {
  const [activeIndex, selectTab] = usePersistedTabIndex(
    APP_CONSTANTS.DASHBOARD_RECENT_CARD_STORAGE_KEY,
    tabs,
  );
  const t = useTranslations("dashboard");
  const formatDate = useFormatDate();
  const label = useLabel();
  const text: Text = {
    date: (d) => formatDate(d, GROUP_DATE),
    noDate: t("recent.noDate"),
    inProgress: t("recent.inProgress"),
  };
  const tabLabel = { Jobs: t("recent.jobsTab"), Activities: t("recent.activitiesTab") };
  const formatDuration = (totalMinutes: number) =>
    totalMinutes === 0
      ? t("recent.durationZero")
      : t("recent.duration", {
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60,
        });
  const { startActivity } = useActivity();
  const { requestStart, confirmDialog } = useActivitySwitchConfirm();

  return (
    <Card className="mb-2 @3xl/main:mb-0">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg text-green-600 min-w-0 truncate">
            {activeIndex === 0 ? t("recent.jobsTitle") : t("recent.activitiesTitle")}
          </CardTitle>
          <div
            className="flex shrink-0 rounded-md border text-xs"
            data-testid="recent-card-toggle-group"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab}
                onClick={() => selectTab(index)}
                className={cn(
                  "px-2 py-1 transition-colors",
                  index === 0 && "rounded-l-md",
                  index === tabs.length - 1 && "rounded-r-md",
                  activeIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {tabLabel[tab]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid auto-rows-max gap-6 px-4">
        {activeIndex === 0
          ? groupJobsByDate(jobs, text).map(([date, dateJobs]) => (
              <div key={date} className="grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {date}
                </p>
                {dateJobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-4">
                    <Avatar className="hidden h-8 w-8 sm:flex">
                      <AvatarImage
                        src={job.Company?.logoUrl || "/images/jobsync-logo.svg"}
                        alt={t("recent.logoAlt")}
                      />
                      <AvatarFallback>JS</AvatarFallback>
                    </Avatar>
                    <Link href={`/dashboard/myjobs/${job?.id}`} className="min-w-0">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium leading-none truncate">
                          {job.JobTitle?.label}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {job.Company?.label}
                          {job.Location?.label ? ` · ${job.Location.label}` : ""}
                        </p>
                      </div>
                    </Link>
                    {job.Status?.label ? (
                      <StatusBadge
                        label={label("jobStatus", job.Status)}
                        color={getJobStatusBadgeColor(job.Status.value)}
                        className="ml-auto shrink-0 justify-center text-xs px-1.5 py-0 h-5"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ))
          : groupActivitiesByDate(activities, text).map(([date, dateActivities]) => (
              <div key={date} className="grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {date}
                </p>
                <div className="grid gap-4">
                  {dateActivities.map((activity) => (
                    <div
                      key={activity.id}
                      data-testid="recent-activity-row"
                      className="relative flex items-center gap-2"
                    >
                      <Button
                        title={t("recent.startActivity")}
                        data-testid="recent-activity-start-btn"
                        size="icon"
                        variant="ghost"
                        onClick={() => requestStart(() => startActivity(activity.id))}
                        className="h-9 w-9 shrink-0"
                      >
                        <span>
                          <CirclePlay className="text-green-600 h-6 w-6" />
                        </span>
                      </Button>
                      <div className="grid gap-1 min-w-0 flex-1">
                        <p className="text-sm font-medium leading-none truncate">
                          {activity.activityName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {activity.activityType?.label || t("recent.unknownType")}
                        </p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-sm font-medium">
                          {formatDuration(activity.duration ?? 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
