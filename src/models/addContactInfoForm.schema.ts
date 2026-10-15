import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddContactInfoFormSchema = z.object({
  id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  resumeId: z.string().optional(),
  firstName: z
    .string({
      error: () => vt("contactInfo.firstName.required"),
    })
    .min(2, {
      error: () => vt("contactInfo.firstName.min", { min: 2 }),
    }),
  lastName: z
    .string({
      error: () => vt("contactInfo.lastName.required"),
    })
    .min(2, {
      error: () => vt("contactInfo.lastName.min", { min: 2 }),
    }),
  headline: z
    .string({
      error: () => vt("contactInfo.headline.required"),
    })
    .min(2, {
      error: () => vt("contactInfo.headline.min", { min: 2 }),
    }),
  email: z
    .string({
      error: () => vt("contactInfo.email.required"),
    })
    .email({ error: () => vt("contactInfo.email.invalid") }),
  phone: z.string({
    error: () => vt("contactInfo.phone.required"),
  }),
  address: z.string().optional(),
  url1: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { error: () => vt("contactInfo.url.protocol") }),
  url1Label: z.string().optional(),
  url2: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { error: () => vt("contactInfo.url.protocol") }),
  url2Label: z.string().optional(),
});
