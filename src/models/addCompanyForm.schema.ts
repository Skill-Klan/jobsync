import { z } from "zod";
import { vt, type ValidationKey, whenMissing } from "@/i18n/validation";
import { COMPANY_NOTES_MAX_LENGTH, COMPANY_SIZES } from "@/lib/constants";

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Absolute http(s) only. Deliberately not a flag on isValidUrl: a logo may be
// a bundled asset like /icons/logo.svg, an employer's website never is.
const isValidHttpUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const httpUrlField = (message: ValidationKey) =>
  z
    .string()
    .default("")
    .optional()
    .refine(
      (url) => !url || isValidHttpUrl(url),
      { error: () => vt(message) },
    );

export const AddCompanyFormSchema = z.object({
  id: z.string().optional(),
  createdBy: z.string().optional(),
  company: z
    .string({
      error: whenMissing("fields.company.required"),
    })
    .min(1),
  logoUrl: z
    .string()
    .default("")
    .optional()
    .refine(
      (url) => !url || url.startsWith("/") || isValidUrl(url),
      { error: () => vt("company.logoUrl.invalid") },
    ),
  websiteUrl: httpUrlField("company.websiteUrl.invalid"),
  careersUrl: httpUrlField("company.careersUrl.invalid"),
  industry: z.string().default("").optional(),
  linkedinUrl: httpUrlField("company.linkedinUrl.invalid"),
  size: z.enum(COMPANY_SIZES).or(z.literal("")).optional(),
  notes: z.string().max(COMPANY_NOTES_MAX_LENGTH).default("").optional(),
});
