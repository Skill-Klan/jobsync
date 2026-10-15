import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddCertificationFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("Certifications").optional(),
  title: z
    .string({
      error: () => vt("certification.title.required"),
    })
    .min(2),
  organization: z
    .string({
      error: () => vt("certification.organization.required"),
    })
    .min(2),
  issueDate: z.date().nullable().optional(),
  expirationDate: z.date().nullable().optional(),
  credentialUrl: z.string().nullable().optional(),
  noExpiration: z.boolean().default(false).optional(),
});
