import { z } from "zod";
import { vt } from "@/i18n/validation";
import { APP_CONSTANTS } from "@/lib/constants";

export const AddQuestionFormSchema = z.object({
  id: z.string().optional(),
  question: z
    .string({ error: () => vt("questions.question.required") })
    .min(APP_CONSTANTS.MIN_QUESTION_LENGTH, {
      error: () => vt("questions.question.min", { min: APP_CONSTANTS.MIN_QUESTION_LENGTH }),
    })
    .max(APP_CONSTANTS.MAX_QUESTION_LENGTH, {
      error: () => vt("questions.question.max", { max: APP_CONSTANTS.MAX_QUESTION_LENGTH }),
    }),
  answer: z
    .string({ error: () => vt("questions.answer.required") })
    .max(APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH, {
      error: () => vt("questions.answer.max", { max: APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH }),
    })
    .refine((val) => val === "TBD" || val.length >= APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH, {
      error: () => vt("questions.answer.min", { min: APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH }),
    }),
  tagIds: z
    .array(z.string())
    .max(APP_CONSTANTS.MAX_JOB_TAGS, { error: () => vt("questions.tags.max", { max: APP_CONSTANTS.MAX_JOB_TAGS }) })
    .optional(),
});
