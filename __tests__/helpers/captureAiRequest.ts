// Records the first HTTP request an AI SDK call makes, without letting it
// reach the network: global fetch is replaced for the duration of `run`.
// Headers that carry library versions (user-agent) are dropped, so the
// record describes the request contract, not the SDK build that sent it.
export type CapturedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

export async function captureRequest(run: () => Promise<unknown>): Promise<CapturedRequest> {
  const original = globalThis.fetch;
  let captured: CapturedRequest | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      if (key !== "user-agent") headers[key] = value;
    });
    captured ??= {
      url: String(input instanceof Request ? input.url : input),
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    };
    throw new Error("captured: no network in tests");
  }) as typeof fetch;
  try {
    await run().catch(() => undefined);
  } finally {
    globalThis.fetch = original;
  }
  if (!captured) throw new Error("the call made no HTTP request");
  return captured;
}
