// @vitest-environment node
// Requirement — the credit alerts count hours of recording (D104) at the real
// price unless app.env says otherwise. Measured 2026-11-21 (creditWatch.ts): an
// hour costs ≈ 1 018 credits, and the balance that day was 31 206 credits — by
// hand 31 206 / 1 018 × 60 = 1 839 min, about 30 h: nothing to alert. With no
// ELEVENLABS_CREDITS_PER_HOUR the server's own watch must read it so; a rate set
// in app.env still wins (paired).
const ctx = vi.hoisted(() => ({ remaining: 31206, sent: [] as unknown[] }));

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/skillklan/featureFlags", () => ({ readFeatureFlags: async () => ({ transcripts: true }) }));
vi.mock("@/skillklan/interviewRecordings", () => ({ fetchRecordingBytes: async () => null, findRecording: async () => null }));
vi.mock("@/skillklan/transcripts/credits", () => ({ readCredits: async () => ({ remaining: ctx.remaining, overage: false }) }));
vi.mock("@/skillklan/transcripts/botAlert", () => ({ sendBotAlert: async (...args: unknown[]) => void ctx.sent.push(args) }));

const KEY = "sk_test_0123456789abcdef0123456789abcdef";

async function freshWatch(env: Record<string, string | undefined>) {
  vi.resetModules();
  delete (globalThis as { skillklanCreditWatch?: { timer: ReturnType<typeof setInterval> } }).skillklanCreditWatch;
  vi.stubEnv("ELEVENLABS_API_KEY", KEY);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  const { creditWatch } = await import("@/skillklan/transcripts/service");
  return creditWatch();
}

afterEach(() => {
  const held = (globalThis as { skillklanCreditWatch?: { timer: ReturnType<typeof setInterval> } }).skillklanCreditWatch;
  if (held) clearInterval(held.timer);
  delete (globalThis as { skillklanCreditWatch?: unknown }).skillklanCreditWatch;
  vi.unstubAllEnvs();
  ctx.sent.length = 0;
});

it("no rate in app.env: the measured price — 31 206 credits are ≈ 30 h, no alert", async () => {
  const watch = await freshWatch({ ELEVENLABS_CREDITS_PER_HOUR: "" });
  expect(await watch.check()).toEqual({ known: true, level: "ok", remaining: 31206, minutesLeft: 1839 });
  expect(ctx.sent).toEqual([]);
});

it("paired: a rate set in app.env is used — 19 800 an hour makes the same credits 94 min, «закінчуються»", async () => {
  // By hand: 31 206 / 19 800 × 60 = 94.6 → 94 min, under the 2 h threshold.
  const watch = await freshWatch({ ELEVENLABS_CREDITS_PER_HOUR: "19800" });
  expect(await watch.check()).toMatchObject({ known: true, level: "low", minutesLeft: 94 });
  expect(ctx.sent).toEqual([["credits_low", 94, expect.anything()]]);
});
