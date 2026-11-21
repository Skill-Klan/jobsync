import "server-only";
import type { CreditEvent } from "./creditWatch";

// To the managers' group, through the SkillKlan bot (owner D108; contract
// docs/contracts/bot-transcript-alerts.md): POST the event and the minutes left
// to the bot's narrow endpoint with a secret in a header. The bot writes the
// owner's text (D111) into the «Алерти» topic — nothing written here reaches the
// group but the number.
//
// Configuration (app.env on Server2): JOBSYNC_ALERT_SECRET — the same value as the
// bot's; JOBSYNC_ALERT_URL — only to point elsewhere (a stand-in). No secret — the
// alert goes to the log only. Never throws: an alert must not break a transcript.

export const DEFAULT_ALERT_URL = "https://api.skillklan.com.ua/api/webapp/jobsync-alert";
export const ALERT_TIMEOUT_MS = 10_000;

export async function sendBotAlert(
  event: CreditEvent,
  minutesLeft: number | null,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; log?: (message: string) => void } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.error(`[transcripts] ${message}`));
  const secret = env.JOBSYNC_ALERT_SECRET?.trim();
  if (!secret) {
    log(`alert ${event} not sent: JOBSYNC_ALERT_SECRET is not set`);
    return false;
  }
  try {
    const res = await (options.fetchImpl ?? fetch)(env.JOBSYNC_ALERT_URL?.trim() || DEFAULT_ALERT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-jobsync-alert-secret": secret },
      body: JSON.stringify({ event, minutesLeft }),
      cache: "no-store",
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!res.ok) {
      log(`alert ${event} not delivered: the bot answered ${res.status}`);
      return false;
    }
    log(`alert ${event} delivered`);
    return true;
  } catch {
    log(`alert ${event} not delivered: no answer from the bot`);
    return false;
  }
}
