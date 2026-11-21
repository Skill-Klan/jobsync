// @vitest-environment node
// Requirement — the owner, 2026-11-20:
//   D104: «якщо залишилось лише на транскрибування умовно 2 співбесід — сповіщення
//         в Telegram, що закінчуються токени», a reminder once a day until topped
//         up, «поповнено» after; below 1 h — no new transcripts.
//   D109: billing above the plan switched on → an alert and the same stop.
//   D111: four alerts — low (with the time left), out, restored, overage.
//   D112: the balance can't be read → the log only, no alert.
// Hours come from credits at a rate (here 600 credits an hour, so 1 credit =
// 0.1 min); 2 h = 1200 credits, 1 h = 600.
import { createCreditWatch, DEFAULT_CREDITS_PER_HOUR, REMIND_MS, type CreditEvent } from "@/skillklan/transcripts/creditWatch";

const HOUR = 60 * 60 * 1000;

function setup(start: { remaining: number; overage?: boolean }) {
  const state = { remaining: start.remaining, overage: start.overage ?? false, fail: false };
  const clock = { now: Date.parse("2026-11-20T12:00:00Z") };
  const sent: [CreditEvent, number | null][] = [];
  const logs: string[] = [];
  const watch = createCreditWatch({
    read: async () => {
      if (state.fail) throw new Error("credits: status 401");
      return { remaining: state.remaining, overage: state.overage };
    },
    notify: async (event, minutes) => void sent.push([event, minutes]),
    creditsPerHour: 600,
    lowHours: 2,
    stopHours: 1,
    now: () => clock.now,
    log: (m) => void logs.push(m),
  });
  return { watch, state, clock, sent, logs };
}

it("enough left — nothing is said, nothing stops", async () => {
  const { watch, sent } = setup({ remaining: 6000 });
  expect(await watch.check()).toEqual({ known: true, level: "ok", remaining: 6000, minutesLeft: 600 });
  expect(sent).toEqual([]);
  expect(watch.blocked()).toBe(false);
});

it("below 2 h: «закінчуються» once with the time left, again only a day later; transcripts go on", async () => {
  const { watch, state, clock, sent } = setup({ remaining: 6000 });
  await watch.check();
  state.remaining = 1000; // 100 min
  await watch.check();
  expect(sent).toEqual([["credits_low", 100]]);
  expect(watch.blocked()).toBe(false);

  clock.now += HOUR;
  await watch.check();
  expect(sent).toHaveLength(1);

  clock.now += REMIND_MS;
  state.remaining = 900;
  await watch.check();
  expect(sent).toEqual([["credits_low", 100], ["credits_low", 90]]);
});

it("below 1 h: «нові зупинено» and new transcripts stop; topped up: «поповнено» with the time, and they go again", async () => {
  const { watch, state, sent } = setup({ remaining: 1000 });
  await watch.check();
  state.remaining = 500; // 50 min
  await watch.check();
  expect(sent).toEqual([["credits_low", 100], ["credits_out", null]]);
  expect(watch.blocked()).toBe(true);

  state.remaining = 16800; // 28 h
  await watch.check();
  expect(sent.at(-1)).toEqual(["credits_restored", 1680]);
  expect(watch.blocked()).toBe(false);
});

it("overage billing switched on: the alert and the stop (D109), whatever is left", async () => {
  const { watch, state, sent } = setup({ remaining: 6000 });
  await watch.check();
  state.overage = true;
  await watch.check();
  expect(sent).toEqual([["overage_on", null]]);
  expect(watch.blocked()).toBe(true);

  state.overage = false;
  await watch.check();
  expect(sent.at(-1)).toEqual(["credits_restored", 600]);
  expect(watch.blocked()).toBe(false);
});

it("already low at the first look (a restart) — told once", async () => {
  const { watch, sent } = setup({ remaining: 700 });
  await watch.check();
  await watch.check();
  expect(sent).toEqual([["credits_low", 70]]);
});

it("the balance can't be read: the log only (D112), no alert, and the stop stays as it was", async () => {
  const { watch, state, sent, logs } = setup({ remaining: 500 });
  await watch.check();
  expect(watch.blocked()).toBe(true);
  sent.length = 0;

  state.fail = true;
  expect(await watch.check()).toEqual({ known: false });
  expect(sent).toEqual([]);
  expect(logs.at(-1)).toMatch(/could not be read/);
  expect(watch.blocked()).toBe(true);
});

it("never read at all — nothing stops (the key's quota and the provider's 402 still hold)", async () => {
  const { watch, state } = setup({ remaining: 6000 });
  state.fail = true;
  await watch.check();
  expect(watch.blocked()).toBe(false);
});

describe("the default price of an hour", () => {
  // Requirement — the alerts count hours of recording (D104), so the price of an
  // hour must be the real one. Measured 2026-11-21 on the account Job uses (D107):
  // 38.909 s through scribe_v3 was billed 11 credits ($0.0022). By hand:
  // 11 / 38.909 × 3600 = 1 017.8 → 1 018 credits an hour, rounded up so the alerts
  // come early, not late. The balance that day: 40 000 − 8 794 = 31 206 credits
  // = 31 206 / 1 018 × 60 = 1 839 min (30 h 39 min) — plenty, nothing to say.
  // (The price page's «330 credits per minute» read it as 94 min: a false
  // «закінчуються».)
  const watchAt = (remaining: number) => {
    const sent: [CreditEvent, number | null][] = [];
    const watch = createCreditWatch({
      read: async () => ({ remaining, overage: false }),
      notify: async (event, minutes) => void sent.push([event, minutes]),
      creditsPerHour: DEFAULT_CREDITS_PER_HOUR,
      lowHours: 2,
      stopHours: 1,
    });
    return { watch, sent };
  };

  it("is the measured 1 018 credits an hour", () => {
    expect(DEFAULT_CREDITS_PER_HOUR).toBe(1018);
  });

  it("the balance measured that day reads as ≈ 30 h — no alert, no stop", async () => {
    const { watch, sent } = watchAt(31206);
    expect(await watch.check()).toEqual({ known: true, level: "ok", remaining: 31206, minutesLeft: 1839 });
    expect(sent).toEqual([]);
    expect(watch.blocked()).toBe(false);
  });

  it("paired: under 2 h of recording (2 000 credits = 117 min) — «закінчуються» with the time left", async () => {
    const { watch, sent } = watchAt(2000);
    await watch.check();
    expect(sent).toEqual([["credits_low", 117]]);
  });
});
