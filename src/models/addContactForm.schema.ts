import { z } from "zod";
import { vt } from "@/i18n/validation";

const isValidHttpUrl = (url: string) => {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

const optionalText = (max: number) => z.string().max(max).default("").optional();

export const AddContactFormSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string({ error: () => vt("contacts.name.required") })
      .min(1, { error: () => vt("contacts.name.empty") })
      .max(120, { error: () => vt("contacts.name.max", { max: 120 }) }),
    title: optionalText(120),
    email: z
      .string()
      .default("")
      .optional()
      .refine(
        (v) => !v || z.email().safeParse(v).success,
        { error: () => vt("contacts.email.invalid") },
      ),
    phone: optionalText(40),
    linkedinUrl: z
      .string()
      .default("")
      .optional()
      .refine(
        (url) => !url || isValidHttpUrl(url),
        { error: () => vt("contacts.linkedinUrl.invalid") },
      ),
    company: z.string().optional(),
    location: z.string().optional(),
    relationship: optionalText(120),
    workedAtCompany: z.string().optional(),
    workedFrom: z.date().nullable().optional(),
    workedTo: z.date().nullable().optional(),
    // Named for ComboBox's `case "contactRole"` create path, not for the column
    contactRole: z.string().optional(),
    notes: optionalText(2000),
    lastContactedAt: z
      .date()
      .nullable()
      .optional()
      .refine(
        (date) => {
          if (!date) return true;
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          return date <= endOfToday;
        },
        { error: () => vt("contacts.lastContactedAt.future") },
      ),
  })
  .refine(
    (v) => !v.workedFrom || !v.workedTo || v.workedTo >= v.workedFrom,
    { error: () => vt("contacts.workedTo.beforeStart"), path: ["workedTo"] },
  );

export type ContactFormValues = z.infer<typeof AddContactFormSchema>;
