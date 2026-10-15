import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddEducationFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("Education").optional(),
  sectionType: z.string().optional(),
  institution: z
    .string({
      error: () => vt("education.institution.required"),
    })
    .min(2),
  degree: z
    .string({
      error: () => vt("education.degree.required"),
    })
    .min(2),
  fieldOfStudy: z
    .string({
      error: () => vt("education.fieldOfStudy.required"),
    })
    .min(2),
  location: z
    .string({
      error: () => vt("fields.location.required"),
    })
    .min(2, {
      error: () => vt("fields.location.min", { min: 2 }),
    }),
  description: z.string().nullable().optional(),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  degreeCompleted: z.boolean().default(true).optional(),
});
