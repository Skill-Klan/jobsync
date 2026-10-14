// @vitest-environment node
// What each AI provider puts on the wire for a plain generateText call. The
// fixture was captured before the 2026-10-14 provider security update
// (@ai-sdk/openai 3.0.2, @ai-sdk/deepseek 2.0.4, @ai-sdk/google 3.0.53):
// updating a provider package must not change the URL, method, headers or
// body we send. If a deliberate change lands, re-capture and say why.
import { generateText } from "ai";
import { PROVIDER_FACTORIES } from "@/lib/ai/provider-registry.server";
import { captureRequest } from "./helpers/captureAiRequest";
import before from "./fixtures/ai-provider-requests.json";

const CASES = [
  ["openai", "gpt-4o-mini"],
  ["openrouter", "openai/gpt-4o-mini"],
  ["deepseek", "deepseek-chat"],
  ["gemini", "gemini-2.0-flash"],
] as const;

describe.each(CASES)("%s request", (name, model) => {
  it("is unchanged from before the provider update", async () => {
    const request = await captureRequest(() =>
      generateText({
        model: PROVIDER_FACTORIES[name]("test-key-not-real", model),
        prompt: "ping",
        maxRetries: 0,
      }),
    );
    expect(request).toEqual(before[name]);
  });
});
