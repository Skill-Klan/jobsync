import { z } from "zod";
import { vt } from "@/i18n/validation";
import { APP_CONSTANTS } from "@/lib/constants";

export const CreateResumeFormSchema = z.object({
  id: z.string().optional(),
  createdBy: z.string().optional(),
  title: z
    .string()
    .min(1, { error: () => vt("resume.title.required") })
    .max(100, { error: () => vt("resume.title.max", { max: 100 }) }),
  profileId: z.string().optional(),
  file: z
    .instanceof(File)
    .refine((file) => (APP_CONSTANTS.RESUME_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type), {
      error: () => vt("resume.file.type"),
    })
    .refine((file) => file.size <= APP_CONSTANTS.MAX_RESUME_FILE_SIZE_BYTES, {
      error: () => vt("resume.file.size"),
    })
    .optional(),
  fileId: z.string().optional(),
});
