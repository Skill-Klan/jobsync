// @vitest-environment node
// Requirement — the owner, 2026-11-20 (D104, D109): what is left of the ElevenLabs
// credits, and whether billing above the plan is on. ElevenLabs' docs
// (GET /v1/user/subscription, read 2026-11-20): left = character_limit −
// character_count; `max_credit_limit_extension` — "unlimited" means no cap, 0 means
// usage-based billing is disabled; `current_overage` — the overage cost so far.
// Overage on, or already billed → treated as on (D109: then transcripts stop).
// A failed reading is an error to the caller (D112 sends it to the log only).
import { CreditsReadError, ELEVENLABS_SUBSCRIPTION_URL, creditsOf, readCredits } from "@/skillklan/transcripts/credits";

// Shaped like the docs' example answer.
const ANSWER = {
  tier: "starter",
  character_count: 1000,
  character_limit: 30000,
  max_character_limit_extension: 0,
  max_credit_limit_extension: 0,
  can_extend_character_limit: true,
  allowed_to_extend_character_limit: false,
  current_overage: { currency: "usd", amount: 0 },
  status: "active",
  next_character_count_reset_unix: 1_795_000_000,
};

describe("creditsOf", () => {
  it("left = limit − used; overage off when the extension is 0 and nothing is billed", () => {
    expect(creditsOf(ANSWER)).toEqual({ remaining: 29000, overage: false });
  });

  it("used past the limit — nothing left, never negative", () => {
    expect(creditsOf({ ...ANSWER, character_count: 31000 }).remaining).toBe(0);
  });

  it.each([
    ["a cap above the plan", { max_credit_limit_extension: 10000 }],
    ["no cap", { max_credit_limit_extension: "unlimited" }],
    ["already billed above the plan", { current_overage: { currency: "usd", amount: 0.4 } }],
  ])("overage on: %s", (_name, patch) => {
    expect(creditsOf({ ...ANSWER, ...patch }).overage).toBe(true);
  });

  it.each([
    ["no counts", { character_count: undefined }],
    ["a count as text", { character_limit: "30000" }],
    ["an unknown extension", { max_credit_limit_extension: "some" }],
  ])("an answer we can't trust (%s) is an error, not a guess", (_name, patch) => {
    expect(() => creditsOf({ ...ANSWER, ...patch })).toThrow(CreditsReadError);
  });
});

describe("readCredits", () => {
  it("asks the subscription endpoint with the key in xi-api-key", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(ANSWER), { status: 200 }));
    expect(await readCredits({ key: "sk_test_key_0123456789", fetchImpl: fetchImpl as typeof fetch })).toEqual({ remaining: 29000, overage: false });
    expect(fetchImpl.mock.calls[0][0]).toBe(ELEVENLABS_SUBSCRIPTION_URL);
    expect(ELEVENLABS_SUBSCRIPTION_URL).toBe("https://api.elevenlabs.io/v1/user/subscription");
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get("xi-api-key")).toBe("sk_test_key_0123456789");
  });

  it.each([401, 403, 500])("ElevenLabs answers %i (e.g. a key that may not read the account) → an error", async (status) => {
    const fetchImpl = async () => new Response(JSON.stringify({ detail: { status: "missing_permissions" } }), { status });
    await expect(readCredits({ key: "sk_test_key_0123456789", fetchImpl: fetchImpl as typeof fetch })).rejects.toThrow(CreditsReadError);
  });

  it("no answer → an error that does not carry the key", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await readCredits({ key: "sk_test_key_0123456789", fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CreditsReadError);
    expect(String((error as Error).message)).not.toContain("sk_test_key");
  });
});
