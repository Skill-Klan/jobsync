import { format } from "date-fns";
import {
  getActivityCalendarData,
  getActivityDataForPeriod,
  getJobsActivityForPeriod,
  getJobsActivitySummary,
  getRecentActivities,
  getRecentJobs,
} from "@/actions/dashboard.actions";
import {
  getDailyGoalValues,
  getGoalStreaks,
} from "@/actions/dailyGoals.actions";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import DailyGoalsCalendar from "@/components/dashboard/DailyGoalsCalendar";
import JobsActivityCard from "@/components/dashboard/JobsActivityCard";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";

import { Metadata } from "next";
import { getTranslations } from "@/i18n/server";
import { getFeatureFlags } from "@/skillklan/featureFlags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function Dashboard() {
  const t = await getTranslations("dashboard");
  // Server-computed so server and browser agree on "today"
  const today = format(new Date(), "yyyy-MM-dd");
  // Activities switched off (Settings → «Функції»): the dashboard is about
  // applications only — no hours, no activity chart or calendar, no activity
  // goal, no recent activities — and their data is not even read.
  const { activities } = await getFeatureFlags();
  const [
    summary7Days,
    summary30Days,
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,
    dailyGoals,
    goalStreaks,
  ] = await Promise.all([
    activities ? getJobsActivitySummary(7) : null,
    activities ? getJobsActivitySummary(30) : null,
    getRecentJobs(),
    activities ? getRecentActivities() : [],
    getJobsActivityForPeriod(),
    activities ? getActivityDataForPeriod() : null,
    activities ? getActivityCalendarData() : null,
    getDailyGoalValues(today.slice(0, 7)),
    getGoalStreaks(),
  ]);
  return (
    <>
      <div className="grid gap-4 @3xl/main:col-span-2">
        <div className="@container grid grid-cols-1 auto-rows-max items-start gap-2 md:gap-2">
          <div className="grid gap-2 @lg:grid-cols-4">
            <JobsApplied />
            {summary7Days && summary30Days && (
              <JobsActivityCard
                data={[
                  { id: "7d", label: t("jobsActivity.range7d"), summary: summary7Days },
                  { id: "30d", label: t("jobsActivity.range30d"), summary: summary30Days },
                ]}
              />
            )}
          </div>
          <WeeklyBarChartToggle
            charts={[
              {
                id: "Jobs",
                label: t("weekly.jobsTab"),
                title: t("weekly.jobsTitle"),
                data: weeklyData,
                keys: ["value"],
                axisLeftLegend: t("weekly.jobsAxis"),
                valueLabel: t("weekly.jobsValue"),
              },
              ...(activitiesData
                ? [
                    {
                      id: "Activities",
                      label: t("weekly.activitiesTab"),
                      title: t("weekly.activitiesTitle"),
                      data: activitiesData.data,
                      keys: activitiesData.keys,
                      groupMode: "stacked" as const,
                      axisLeftLegend: t("weekly.activitiesAxis"),
                    },
                  ]
                : []),
            ]}
          />
        </div>
        {activityCalendarData && (
          <div className="w-full">
            <ActivityCalendar
              years={Object.keys(activityCalendarData)}
              dataByYear={activityCalendarData}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <DailyGoalsCalendar
          today={today}
          initialData={dailyGoals.success ? dailyGoals.data : null}
          initialStreaks={goalStreaks.success ? goalStreaks.data : null}
        />
      </div>
      <div className="w-full col-span-3">
        <RecentCardToggle jobs={recentJobs} activities={recentActivities} />
      </div>
    </>
  );
}
