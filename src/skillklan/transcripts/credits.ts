import "server-only";

// The ElevenLabs account's credits, for the alerts about them (owner D104,
// D108–D112). GET /v1/user/subscription (docs read 2026-11-20): what is left is
// `character_limit - character_count` — the account's one pool, shared with the
// videos' voice-over (D107); overage billing is on when `max_credit_limit_extension`
// is not 0 ("unlimited" or a number), or something is already billed above the
// plan (`current_overage.amount > 0`).
//
// Read with the same key as the transcripts. A key limited to speech-to-text may
// not be allowed to read the account: then — like any other failure — the reading
// fails, and that goes to the log only (owner D112).

export const ELEVENLABS_SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";
export const CREDITS_TIMEOUT_MS = 10_000;

export type Credits = {
  // Credits left in the current period.
  remaining: number;
  // Billing above the plan is on, or has already started.
  overage: boolean;
};

export class CreditsReadError extends Error {
  constructor(readonly reason: string) {
    super(`credits: ${reason}`);
    this.name = "CreditsReadError";
  }
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function creditsOf(body: unknown): Credits {
  const data = body as Record<string, unknown> | null;
  if (!data || typeof data !== "object") throw new CreditsReadError("shape");
  const { character_count: used, character_limit: limit, max_credit_limit_extension: extension, current_overage: overage } = data;
  if (!isCount(used) || !isCount(limit)) throw new CreditsReadError("shape");
  if (!(extension === "unlimited" || isCount(extension))) throw new CreditsReadError("shape");
  const overageAmount = (overage as { amount?: unknown } | null | undefined)?.amount;
  const billed = typeof overageAmount === "number" ? overageAmount : Number(overageAmount ?? 0);
  return {
    remaining: Math.max(0, limit - used),
    overage: extension === "unlimited" || extension > 0 || (Number.isFinite(billed) && billed > 0),
  };
}

export async function readCredits(options: { key: string; fetchImpl?: typeof fetch }): Promise<Credits> {
  let res: Response;
  try {
    res = await (options.fetchImpl ?? fetch)(ELEVENLABS_SUBSCRIPTION_URL, {
      headers: { "xi-api-key": options.key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(CREDITS_TIMEOUT_MS),
    });
  } catch {
    throw new CreditsReadError("network");
  }
  if (!res.ok) throw new CreditsReadError(`status ${res.status}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CreditsReadError("shape");
  }
  return creditsOf(body);
}
