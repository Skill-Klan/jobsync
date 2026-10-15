import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddExperienceFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("Experience").optional(),
  sectionType: z.string().optional(),
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
  jobDescription: z.string().min(10, {
    error: () => vt("fields.jobDescription.min", { min: 10 }),
  }),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  currentJob: z.boolean().default(false).optional(),
});
