import type { Credits } from "./credits";

// Watching the ElevenLabs credits (owner D104, D108–D112): before every
// transcript and once an hour.
//
//   · what is left, in hours of recording: below 2 h («умовно на 2 співбесіди»)
//     — «закінчуються кредити, лишилось ≈ N»; below 1 h — «нові транскрибації
//     зупинено», and no new recording is queued or started;
//   · billing above the plan on — «увімкнулась оплата понад тариф», and the same
//     stop (D109): otherwise the limit quietly stops being a limit;
//   · back to enough — «поповнено, транскрибація знову працює»;
//   · each alert once, then a reminder once a day while it lasts;
//   · the balance can't be read — the log only (D112); the stop stays as it was.
//
// The alerts go to the managers' group through the SkillKlan bot (D108); the
// texts are the bot's (D111) — this side sends only the event and the minutes.
// The state lives in this process: after a restart a lasting problem is told
// once more on the first check.

export type CreditEvent = "credits_low" | "credits_out" | "credits_restored" | "overage_on";
export type CreditLevel = "ok" | "low" | "out" | "overage";

export type CreditCheck =
  | { known: true; level: CreditLevel; remaining: number; minutesLeft: number }
  | { known: false };

export type CreditWatchOptions = {
  read: () => Promise<Credits>;
  notify: (event: CreditEvent, minutesLeft: number | null) => Promise<void>;
  // How many credits an hour of recording costs — DEFAULT_CREDITS_PER_HOUR
  // unless app.env says otherwise.
  creditsPerHour: number;
  lowHours: number;
  stopHours: number;
  remindMs?: number;
  now?: () => number;
  log?: (message: string) => void;
};

export const REMIND_MS = 24 * 60 * 60 * 1000;

// Credits an hour of recording costs, measured 2026-11-21 on the account Job
// uses (D107): 38.909 s of speech through scribe_v3 was billed 11 credits
// (`character-cost`) and $0.0022 — ≈ 1 018 credits, $0.20 an hour, the API price
// page's dollars. Rounded up, so the alerts come a little early, not late. The
// other page's «330 credits per minute» (19 800 an hour) is not the API price:
// with it, 31 206 credits left read as 1.6 h instead of 30 — «закінчуються»
// for nothing, and the stop soon after.
export const MEASURED = { credits: 11, seconds: 38.909 } as const;
export const DEFAULT_CREDITS_PER_HOUR = Math.ceil((MEASURED.credits / MEASURED.seconds) * 3600);

const EVENT_OF: Record<Exclude<CreditLevel, "ok">, CreditEvent> = {
  low: "credits_low",
  out: "credits_out",
  overage: "overage_on",
};

export function createCreditWatch(options: CreditWatchOptions) {
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => {});
  const remindMs = options.remindMs ?? REMIND_MS;
  let level: CreditLevel | null = null;
  let toldAt = 0;

  const levelOf = (credits: Credits, minutesLeft: number): CreditLevel => {
    if (credits.overage) return "overage";
    if (minutesLeft < options.stopHours * 60) return "out";
    if (minutesLeft < options.lowHours * 60) return "low";
    return "ok";
  };

  async function tell(next: CreditLevel, minutesLeft: number): Promise<void> {
    toldAt = now();
    if (next === "ok") return options.notify("credits_restored", minutesLeft);
    return options.notify(EVENT_OF[next], next === "low" ? minutesLeft : null);
  }

  async function check(): Promise<CreditCheck> {
    let credits: Credits;
    try {
      credits = await options.read();
    } catch (error) {
      log(`the credits could not be read (${error instanceof Error ? error.message : "unknown"})`);
      return { known: false };
    }
    const minutesLeft = Math.floor((credits.remaining / options.creditsPerHour) * 60);
    const next = levelOf(credits, minutesLeft);
    const before = level;
    level = next;
    try {
      if (next !== before) {
        // The first look at a healthy account says nothing; anything else is news.
        if (!(before === null && next === "ok")) await tell(next, minutesLeft);
      } else if (next !== "ok" && now() - toldAt >= remindMs) {
        await tell(next, minutesLeft);
      }
    } catch (error) {
      log(`the alert was not delivered (${error instanceof Error ? error.message : "unknown"})`);
    }
    return { known: true, level: next, remaining: credits.remaining, minutesLeft };
  }

  // No new transcript while the credits are nearly out or overage billing is on.
  // Unknown (never read, or the reading fails) stops nothing: the key's own quota
  // and the provider's 402 still hold (D112).
  const blocked = () => level === "out" || level === "overage";

  return { check, blocked };
}

export type CreditWatch = ReturnType<typeof createCreditWatch>;
