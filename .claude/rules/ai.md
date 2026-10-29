---
paths:
  - "src/lib/ai/**"
  - "src/lib/agent/**"
  - "src/lib/aiUsage/**"
  - "src/lib/api-key-resolver.ts"
  - "src/actions/aiUsage.actions.ts"
  - "src/actions/agentChat.actions.ts"
  - "src/actions/apiKey.actions.ts"
---

# AI and its money (J4)

Today no AI model is configured in production: AI buttons say «AI-модель не налаштовано». J4 connects it.
The owner's decisions, literally:

- **Cloud models only** (D6). No local models — Ollama is not used and is to be removed.
- **The owner's key, with the school's markup** (D6a). Students don't bring their own keys; don't extend the
  per-user API key flow inherited from upstream.
- **Prepaid balance** (D8): AI stops at zero. The markup size is still open — don't hard-code one.
- **Prices, markup, balances, limits and usage records live in the backend.** This app asks the backend before
  a call and reports usage after it, through a contract in `docs/contracts/` (to be designed — propose it
  there first). Backend unreachable → no AI call (fail closed).
- Every paid feature has an **off switch and a limit** the admin changes without a deploy: AI for everyone,
  AI per student, per-student daily/monthly limits, a monthly budget with alerts at 50 / 80 / 100 %.
- The language of AI answers is not decided (D31) — leave prompts as they are.
- Tests for money are negative first: zero balance, limit reached, AI switched off, backend timeout — no call.
  Before opening to students, the payment path gets a live run with a small real amount.
- Never log prompts or answers with personal data (resume text, names).
