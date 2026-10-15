import { z } from "zod";
import { vt } from "@/i18n/validation";
import { DAILY_GOALS } from "@/lib/constants";

const wholeNumber = (min: number, max: number) =>
  z
    .number({ error: () => vt("goals.number") })
    .int({ error: () => vt("goals.integer") })
    .min(min, { error: () => vt("goals.min", { min }) })
    .max(max, { error: () => vt("goals.max", { max }) });

export const GoalTargetsSchema = z.object({
  jobs: wholeNumber(DAILY_GOALS.JOBS_MIN, DAILY_GOALS.JOBS_MAX),
  hours: wholeNumber(DAILY_GOALS.HOURS_MIN, DAILY_GOALS.HOURS_MAX),
});

export type GoalTargets = z.infer<typeof GoalTargetsSchema>;

// Keyed by "YYYY-MM"; a month with no entry carries the latest earlier one
export type GoalTargetsByMonth = Record<string, GoalTargets>;

export interface GoalStreaks {
  current: number;
  best: number;
}
