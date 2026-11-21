# Transcript credit alerts → the SkillKlan Telegram bot

The ElevenLabs credits that pay for the interview transcripts run low — the managers' group hears about it in
its «Алерти» topic (owner D104, D108–D112, 2026-11-20). This app watches the balance; the SkillKlan bot writes
into the group. Direction: **this app → the bot**. The bot's side lives in its own repository
(`POST /api/webapp/jobsync-alert`, requirement FR-HOOK-04 there).

## The call

`POST https://api.skillklan.com.ua/api/webapp/jobsync-alert`

| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-jobsync-alert-secret` | `JOBSYNC_ALERT_SECRET` — its own secret, the same value on both sides; no other route accepts it |

```json
{ "event": "credits_low", "minutesLeft": 100 }
```

| `event` | When | `minutesLeft` |
|---|---|---|
| `credits_low` | less than 2 h of recording left («умовно 2 співбесіди») | required — whole minutes left |
| `credits_out` | less than 1 h left; new transcripts stop | not used |
| `credits_restored` | back above 2 h, or overage billing switched off again | minutes left, optional |
| `overage_on` | billing above the plan is on or has started (D109); new transcripts stop | not used |

**Answers:** `200 {"ok":true}` — written to the topic (the bot's alert module: the manager bot's token, the same
event at most once in 15 minutes); `400` — an unknown event or a bad number; `401` — a wrong secret; `503` — the
bot has no secret configured (the route is off).

## Rules

- **Only the event and a number leave this app.** The text is the bot's — the owner's, word for word (D111):
  «SkillKlan Job: закінчуються кредити ElevenLabs. Лишилось приблизно на 1 год 40 хв розпізнавання…». Nothing
  from the request body but the number reaches the group.
- **Call budget:** at most once per balance check — before each transcript and once an hour — and only when
  something changed, or once a day while a problem lasts. In practice: a few calls a day.
- **Never in the way of a transcript.** A 10-second timeout; any failure — a log line, no retry, the transcript
  goes on. No secret configured here → the log only.
- **The balance itself is not sent.** This app reads it from ElevenLabs (`GET /v1/user/subscription`) with the
  transcripts' key; when it can't (the key may not read the account, ElevenLabs is down) — the log only (D112).

## Configuration

| Side | Variable |
|---|---|
| this app (`app.env` on Server2) | `JOBSYNC_ALERT_SECRET`; `JOBSYNC_ALERT_URL` only for a stand-in |
| the bot (its `.env` on the production server) | `JOBSYNC_ALERT_SECRET` (same value); `MANAGER_THREAD_ALERTS` — the topic, already set |

Thresholds are in `app.env` too: `TRANSCRIBE_ALERT_HOURS` (2), `TRANSCRIBE_STOP_HOURS` (1) and
`ELEVENLABS_CREDITS_PER_HOUR` (19 800 — the price page's «330 credits per minute»; every transcript logs the
credits it really took, so the rate can be corrected).
