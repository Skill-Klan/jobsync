import { z } from "zod";
import { vt } from "@/i18n/validation";

export const SigninFormSchema = z.object({
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
    .min(1),
});
