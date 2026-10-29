---
paths:
  - "src/actions/automation/**"
  - "src/actions/automation.actions.ts"
  - "src/app/api/automations/**"
  - "src/app/dashboard/automations/**"
  - "src/components/automations/**"
  - "src/lib/scheduler/**"
  - "src/lib/scraper/**"
  - "src/lib/notifications/**"
---

# Automations (job discovery) and notifications

- The whole area is behind the `automations` switch, **off by default** (owner D73–D74). Off: no menu items,
  pages answer 404, every changing action refuses, notifications are hidden with it (D75). The scheduler runs
  outside a request — it reads `readFeatureFlags()`, not `getFeatureFlags()`, and does nothing while off.
- In a test of "switched off", switch off **only this key** and keep the others on (mock with
  `flags.off.has(key)`); the paired test does the opposite. A mock that returns "off" for any key stays
  green when the action checks the wrong switch.
- **Sources must be legal to read.** LinkedIn and Indeed forbid scraping in their terms — no. Work.ua and
  robota.ua have no public feed (partnership only) — no. Usable: Djinni RSS, Happy Monday's official feed,
  company boards through the existing Greenhouse connector. DOU's RSS needs DOU's consent first. A new source
  is the owner's decision.
- Ranking compares Latin text: "AQA Engineer" does not match the query "QA" — add "AQA" as its own query
  rather than loosening matching for everyone.
- A run matches every job it finds to a resume with AI, so automations spend AI money — the AI rules
  (switches, limits, balance) apply to them.
