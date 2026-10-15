import { z } from "zod";
import { vt } from "@/i18n/validation";

export const CoverLetterFormSchema = z.object({
  id: z.string().optional(),
  title: z
    .string({
      error: () => vt("coverLetter.title.required"),
    })
    .min(1, {
      error: () => vt("coverLetter.title.required"),
    })
    .max(100, {
      error: () => vt("coverLetter.title.max", { max: 100 }),
    }),
  content: z
    .string({
      error: () => vt("coverLetter.content.required"),
    })
    .min(10, {
      error: () => vt("coverLetter.content.min", { min: 10 }),
    }),
});
