import { APP_CONSTANTS } from "@/lib/constants";
import { combineDateAndTime } from "@/lib/utils";
import { differenceInMinutes, startOfDay } from "date-fns";
import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddActivityFormSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().optional(),
    activityName: z
      .string({
        error: () => vt("activities.name.required"),
      })
      .min(2, {
        error: () => vt("activities.name.min", { min: 2 }),
      }),
    activityType: z.string().min(1, {
      error: () => vt("activities.type.required"),
    }),
    startDate: z.date(),
    startTime: z
      .string()
      .regex(
        /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
        { error: () => vt("activities.startTime.format") }
      ),
    endDate: z.date().optional(),
    endTime: z
      .string()
      .regex(
        /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
        { error: () => vt("activities.endTime.format") }
      )
      .optional(),
    duration: z
      .number()
      .min(0, { error: () => vt("activities.duration.negative") })
      .optional(),
    description: z
      .string()
      .max(1000, {
        error: () => vt("activities.description.max", { max: 1000 }),
      })
      .optional(),
  })
  // Compare calendar days only: a picked date is local midnight while an
  // untouched default carries the current time, so raw Dates aren't comparable
  .refine(
    (data) => {
      if (!data.endDate) return true; // Skip if no endDate
      return startOfDay(data.endDate) >= startOfDay(data.startDate);
    },
    {
      error: () => vt("activities.endDate.beforeStart"),
      path: ["endDate"], // Target the error message to `endDate`
    }
  )
  // Check if the end date/time is earlier than the start date/time
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      // Combine date and time to compare
      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      return endDateTime > startDateTime; // Valid only if endDateTime is after startDateTime
    },
    {
      error: () => vt("activities.endTime.beforeStart"),
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      const durationInMinutes = differenceInMinutes(endDateTime, startDateTime);
      return durationInMinutes <= APP_CONSTANTS.ACTIVITY_MAX_DURATION_MINUTES; // Ensure duration is within max duration allowed
    },
    {
      error: () =>
        vt("activities.duration.tooLong", {
          hours: APP_CONSTANTS.ACTIVITY_MAX_DURATION_MINUTES / 60,
        }),
      path: ["endTime"],
    }
  )
  // Match the timer, which discards anything shorter than the minimum
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      const durationInMinutes = differenceInMinutes(endDateTime, startDateTime);
      return durationInMinutes >= APP_CONSTANTS.ACTIVITY_MIN_DURATION_MINUTES;
    },
    {
      error: () =>
        vt("activities.duration.tooShort", {
          minutes: APP_CONSTANTS.ACTIVITY_MIN_DURATION_MINUTES,
        }),
      path: ["endTime"],
    }
  )
  .refine(
    (data) => combineDateAndTime(data.startDate, data.startTime) <= new Date(),
    {
      error: () => vt("activities.start.future"),
      path: ["startTime"],
    }
  );
