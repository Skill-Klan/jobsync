import { z } from "zod";
import { vt } from "@/i18n/validation";

export const AddTaskFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string({ error: () => vt("tasks.title.required") })
    .min(2, { error: () => vt("tasks.title.min", { min: 2 }) }),
  description: z
    .string()
    .max(2000, { error: () => vt("tasks.description.max", { max: 2000 }) })
    .optional()
    .nullable(),
  status: z.enum(["in-progress", "complete", "needs-attention", "cancelled"]),
  priority: z.number().min(0).max(10),
  percentComplete: z.number().min(0).max(100),
  dueDate: z
    .date()
    .optional()
    .nullable()
    .refine(
      (date) => {
        if (!date) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      { error: () => vt("tasks.dueDate.past") }
    ),
  activityTypeId: z.string().optional().nullable(),
});
