"use client";

import { useMemo, useState } from "react";
import {
  GcMonthCalendar,
  GcMonthSummary,
  type GcGoal,
} from "react-goal-calendar";
import { getDailyGoalValues } from "@/actions/dailyGoals.actions";
import { Card } from "@/components/ui/card";
import SetGoalsDialog from "@/components/dashboard/SetGoalsDialog";
import {
  GOAL_IDS,
  buildMonthSummary,
  goalIdsFor,
  goalMonthRange,
  resolveTargets,
  type GoalMonthData,
  type GoalValues,
  type MonthSummary,
} from "@/lib/dailyGoals";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "@/i18n/client";
import { useFeatures } from "@/context/FeaturesContext";
import type {
  GoalStreaks,
  GoalTargets,
  GoalTargetsByMonth,
} from "@/models/dailyGoals.model";

// The calendar library formats month titles, weekdays and numbers by a BCP 47
// locale; its own words come in through `labels`.
const CALENDAR_LOCALE = { uk: "uk-UA", en: "en-US" } as const;

interface DailyGoalsCalendarProps {
  today: string;
  initialData: GoalMonthData | null;
  initialStreaks: GoalStreaks | null;
}

export default function DailyGoalsCalendar({
  today,
  initialData,
  initialStreaks,
}: DailyGoalsCalendarProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  // Activities switched off: no hours goal — no orange ring, no legend entry,
  // and "goal met" and the streaks count applications alone.
  const goalIds = goalIdsFor(useFeatures());
  const withHours = goalIds.includes(GOAL_IDS.HOURS);
  // The summary's rings need labels only; targets vary by month
  const JOBS_RING = { id: GOAL_IDS.JOBS, label: t("goals.jobsRing") };
  const HOURS_RING = { id: GOAL_IDS.HOURS, label: t("goals.activityRing") };
  const RINGS = withHours ? [JOBS_RING, HOURS_RING] : [JOBS_RING];
  const goalsFor = (targets: GoalTargets): GcGoal[] => [
    { ...JOBS_RING, target: targets.jobs },
    ...(withHours
      ? [{ ...HOURS_RING, target: targets.hours, unit: t("goals.hoursUnit") }]
      : []),
  ];
  const navLabels = {
    previousMonth: t("goals.previousMonth"),
    nextMonth: t("goals.nextMonth"),
  };
  const summaryText = {
    currentStreak: t("goals.currentStreak"),
    bestStreak: t("goals.bestStreak"),
    bothMet: t("goals.bothMet"),
    goalMet: t("goals.goalHit"),
    nothingLogged: t("goals.nothingLogged"),
    days: (count: number) => t("goals.days", { count }),
  };
  const { minMonth, maxMonth } = goalMonthRange(today);
  const [month, setMonth] = useState(maxMonth);
  // null = the server fetch failed: leave uncached so it shows "—"
  const [valuesByMonth, setValuesByMonth] = useState<
    Record<string, GoalValues>
  >(initialData ? { [maxMonth]: initialData.values } : {});
  // null until any load succeeds; resolves every month, cached or not
  const [storedTargets, setStoredTargets] =
    useState<GoalTargetsByMonth | null>(initialData?.targets ?? null);
  const targetsFor = (key: string) => resolveTargets(key, storedTargets ?? {});
  const [streaks, setStreaks] = useState(initialStreaks);
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Stable identity: the dialog re-applies its pre-fill when this changes
  const currentTargets = useMemo(
    () => resolveTargets(maxMonth, storedTargets ?? {}),
    [maxMonth, storedTargets],
  );

  // Only cached months get an entry; the rest show the package's "—"
  const summaries = useMemo(() => {
    const data: Record<string, MonthSummary> = {};
    for (const [key, values] of Object.entries(valuesByMonth)) {
      data[key] = buildMonthSummary(
        key,
        values,
        today,
        resolveTargets(key, storedTargets ?? {}),
        streaks,
        summaryText,
        goalIds,
      );
    }
    return data;
    // summaryText follows the locale, which re-renders the page when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesByMonth, storedTargets, streaks, today, locale, goalIds]);

  const handleMonthChange = async (next: string) => {
    setMonth(next);
    if (valuesByMonth[next]) return;
    setLoadingMonth(next);
    const result = await getDailyGoalValues(next);
    if (result.success) {
      setValuesByMonth((prev) => ({ ...prev, [next]: result.data.values }));
      // Only fills a failed initial load; a save may be newer than this read
      setStoredTargets((prev) => prev ?? result.data.targets);
    } else {
      toastError(result.message);
    }
    // A later navigation may already own the busy state
    setLoadingMonth((current) => (current === next ? null : current));
  };

  const loading = loadingMonth === month;
  const cardProps = {
    "aria-busy": loading || undefined,
    className: cn("daily-goals-calendar p-4", loading && "opacity-60"),
  };
  const monthProps = {
    locale: CALENDAR_LOCALE[locale === "uk" ? "uk" : "en"],
    today,
    month,
    minMonth,
    maxMonth,
    onMonthChange: handleMonthChange,
  };

  return (
    <>
      <Card {...cardProps}>
        <GcMonthSummary
          rings={RINGS}
          data={summaries}
          labels={{ ...navLabels, goalHit: t("goals.goalHit"), noData: t("goals.noData") }}
          {...monthProps}
        />
      </Card>
      <Card {...cardProps}>
        <GcMonthCalendar
          goals={goalsFor(targetsFor(month))}
          values={valuesByMonth[month]}
          legend
          labels={{ ...navLabels, legend: t("goals.legend"), settings: t("goals.setGoals") }}
          // No button until targets load: the pre-fill would be defaults
          onSettingsClick={
            storedTargets ? () => setDialogOpen(true) : undefined
          }
          {...monthProps}
        />
      </Card>
      <SetGoalsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        month={maxMonth}
        targets={currentTargets}
        withHours={withHours}
        onSaved={(data) => {
          setStoredTargets(data.targets);
          setStreaks(data.streaks);
        }}
      />
    </>
  );
}
