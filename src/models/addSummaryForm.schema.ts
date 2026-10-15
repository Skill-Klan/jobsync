import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddSummarySectionFormSchema = z.object({
  id: z.string().optional(),
  sectionTitle: z
    .string({
      error: () => vt("summary.sectionTitle.required"),
    })
    .min(1),
  sectionType: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  resumeId: z.string().optional(),
  content: z
    .string({
      error: () => vt("summary.content.required"),
    })
    .min(10),
});
