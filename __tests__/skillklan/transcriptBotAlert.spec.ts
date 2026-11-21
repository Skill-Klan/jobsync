// @vitest-environment node
// Requirement — the owner, 2026-11-20 (D108): the alerts go to the managers' group
// through the SkillKlan bot — a narrow endpoint with a secret in a header (contract
// docs/contracts/bot-transcript-alerts.md; the bot's side: POST
// /api/webapp/jobsync-alert, x-jobsync-alert-secret, body { event, minutesLeft }).
// Only the event and the number leave this app — the text is the bot's (D111). No
// secret configured → nothing is sent; a failing bot never breaks a transcript.
import { DEFAULT_ALERT_URL, sendBotAlert } from "@/skillklan/transcripts/botAlert";

const ENV = { JOBSYNC_ALERT_SECRET: "test-alert-secret" } as unknown as NodeJS.ProcessEnv;

it("POSTs the event and the minutes to the bot's endpoint with the secret in its header", async () => {
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }));
  expect(await sendBotAlert("credits_low", 100, { env: ENV, fetchImpl: fetchImpl as typeof fetch, log: () => {} })).toBe(true);

  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe(DEFAULT_ALERT_URL);
  expect(DEFAULT_ALERT_URL).toBe("https://api.skillklan.com.ua/api/webapp/jobsync-alert");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("x-jobsync-alert-secret")).toBe("test-alert-secret");
  expect(JSON.parse(String(init?.body))).toEqual({ event: "credits_low", minutesLeft: 100 });
});

it("no secret configured → nothing is sent, the log says so; paired: with it, it is sent", async () => {
  const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
  const logs: string[] = [];
  expect(await sendBotAlert("credits_out", null, { env: {} as NodeJS.ProcessEnv, fetchImpl, log: (m) => void logs.push(m) })).toBe(false);
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(logs[0]).toMatch(/JOBSYNC_ALERT_SECRET is not set/);

  await sendBotAlert("credits_out", null, { env: ENV, fetchImpl, log: () => {} });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it.each([
  ["the bot refuses (401)", async () => new Response("{}", { status: 401 })],
  ["no answer", async () => Promise.reject(new TypeError("fetch failed"))],
])("%s → false and a log line, never a throw; the secret is not in the log", async (_name, impl) => {
  const logs: string[] = [];
  await expect(sendBotAlert("overage_on", null, { env: ENV, fetchImpl: impl as typeof fetch, log: (m) => void logs.push(m) })).resolves.toBe(false);
  expect(logs.join(" ")).not.toContain("test-alert-secret");
});
