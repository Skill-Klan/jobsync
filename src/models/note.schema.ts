import { z } from "zod";
import { vt } from "@/i18n/validation";

export const NoteFormSchema = z.object({
  id: z.string().optional(),
  jobId: z.string({ error: () => vt("notes.jobId.required") }),
  content: z
    .string({ error: () => vt("notes.content.required") })
    .min(1, { error: () => vt("notes.content.empty") }),
});
