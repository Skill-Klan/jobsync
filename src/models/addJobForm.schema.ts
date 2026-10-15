import { z } from "zod";
import { vt } from "@/i18n/validation";
import { APP_CONSTANTS } from "@/lib/constants";

export const AddJobFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string({
      error: () => vt("fields.jobTitle.required"),
    })
    .min(2, {
      error: () => vt("fields.jobTitle.min", { min: 2 }),
    }),
  company: z
    .string({
      error: () => vt("fields.company.required"),
    })
    .min(2, {
      error: () => vt("fields.company.min", { min: 2 }),
    }),
  location: z
    .string({
      error: () => vt("fields.location.required"),
    })
    .min(2, {
      error: () => vt("fields.location.min", { min: 2 }),
    }),
  type: z.string().min(1),
  workplaceType: z.string().optional(),
  source: z
    .string({
      error: () => vt("jobs.source.required"),
    })
    .min(2, {
      error: () => vt("jobs.source.min", { min: 2 }),
    }),
  status: z
    .string({
      error: () => vt("jobs.status.required"),
    })
    .min(2, {
      error: () => vt("jobs.status.min", { min: 2 }),
    })
    .default("draft"),
  dueDate: z.date(),
  /**
   * Note: Timezone offsets can be allowed by setting the offset option to true.
   * z.string().datetime({ offset: true });
   */
  //
  dateApplied: z.date().optional(),
  salaryRange: z.string().optional(),
  jobDescription: z
    .string({
      error: () => vt("jobs.description.required"),
    })
    .refine((val) => val === "N/A" || val.length >= 10, {
      error: () => vt("fields.jobDescription.min", { min: 10 }),
    }),
  jobUrl: z.string().optional(),
  resume: z.string().optional(),
  coverLetter: z.string().optional(),
  tags: z
    .array(z.string())
    .max(APP_CONSTANTS.MAX_JOB_TAGS)
    .optional()
    .default([]),
});
