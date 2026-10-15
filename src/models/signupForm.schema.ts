import { z } from "zod";
import { vt } from "@/i18n/validation";

export const SignupFormSchema = z.object({
  name: z.string().min(2, {
    error: () => vt("auth.name.min", { min: 2 }),
  }),
  email: z
    .string({
      error: () => vt("auth.email.required"),
    })
    .min(3, {
      error: () => vt("auth.email.min", { min: 3 }),
    })
    .email({ error: () => vt("auth.email.invalid") }),
  password: z
    .string({
      error: () => vt("auth.password.required"),
    })
    .min(6, {
      error: () => vt("auth.password.min", { min: 6 }),
    }),
});
