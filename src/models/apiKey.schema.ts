import { z } from "zod";
import { vt } from "@/i18n/validation";

export const apiKeySaveSchema = z.object({
  provider: z.enum(["openai", "deepseek", "openrouter", "ollama", "gemini"]),
  key: z.string().min(1, { error: () => vt("apiKey.key.required") }),
  label: z.string().optional(),
  sensitive: z.boolean().default(true),
});

export type ApiKeySaveInput = z.infer<typeof apiKeySaveSchema>;
