import { z } from "zod";
import { vt } from "@/i18n/validation";

export const CopyResumeFormSchema = z.object({
  title: z
    .string()
    .min(1, { error: () => vt("resume.title.required") })
    .max(100, { error: () => vt("resume.title.max", { max: 100 }) }),
});
