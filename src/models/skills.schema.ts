import { z } from "zod";
import { vt } from "@/i18n/validation";
import { APP_CONSTANTS } from "@/lib/constants";

const SkillCategorySchema = z.object({
  label: z.string().trim().max(60).optional(),
  tagIds: z
    .array(z.string())
    .min(1, { error: () => vt("skills.tags.min") })
    .max(APP_CONSTANTS.MAX_SKILLS_PER_CATEGORY),
});

export const AddSkillsFormSchema = z.object({
  resumeId: z.string(),
  sectionTitle: z.string().trim().min(1, { error: () => vt("skills.sectionTitle.required") }),
  categories: z
    .array(SkillCategorySchema)
    .min(1, { error: () => vt("skills.categories.min") })
    .max(APP_CONSTANTS.MAX_SKILL_CATEGORIES),
});

export const UpdateSkillsFormSchema = AddSkillsFormSchema.extend({
  sectionId: z.string(),
});

export type AddSkillsForm = z.infer<typeof AddSkillsFormSchema>;
export type UpdateSkillsForm = z.infer<typeof UpdateSkillsFormSchema>;
