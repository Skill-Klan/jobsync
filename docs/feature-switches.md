# Feature switches («Функції»)

The admin or the QA moderator turns parts of SkillKlan Job on or off **for everyone** — themselves included, so
they see what students see — in Settings → «Функції» (owner's decisions D53–D56, D73–D76).

Code: [`src/skillklan/features.ts`](../src/skillklan/features.ts), [`src/skillklan/featureFlags.ts`](../src/skillklan/featureFlags.ts),
[`src/actions/featureToggles.actions.ts`](../src/actions/featureToggles.actions.ts).

## How it works

- **The list and the defaults live in code** (`FEATURES`). The `FeatureToggle` table keeps only the admin's choices
  (`updatedByCabinetUserId` — who). No row → the default. Adding a switch is a code change, not a seed row.
- **Who may switch:** `managesSkillklanJob` — roles `admin` and `qa_moderator`, as the SkillKlan backend says. The role
  lives only in the session token, refreshed by the ≤ 5-minute access re-check. A change asks the backend again at
  that moment (`confirmCabinetAdmin`): a token minted before a demotion is not enough.
- **Hidden, not deleted.** A switched-off part disappears from the menus, its pages answer 404, other pages drop its
  blocks, and **every server action that changes it refuses**. A page opened before the switch went off keeps its
  buttons until reloaded — that is why the actions check too. Data stays; switched back on, it is all there.
- The scheduler runs outside a request: it reads `readFeatureFlags()`, not `getFeatureFlags()`, and does nothing while
  `automations` is off.

## The switches

| Switch | Default | Off means |
|---|---|---|
| `automations` | off | no Automations tab or pages, no "Add Automation" on the dashboard, no discovered-jobs filters; the scheduler runs nothing; notifications (all about automation runs) go too — no bell, no Notifications page; the actions and API routes that change automations or notifications refuse (`run`, `cancel`, `logs/clear` → 403) |
| `activities` | off | no Activities tab, no running-activity banner, no "Start activity" in Tasks; the dashboard shows applications only (no hours card, activity chart or calendar, hours goal); goal days and streaks count applications alone; the actions that change activities refuse |
| `library` | off | no Library («Довідники») tab, company pages answer 404, company names in job lists are plain text; the actions only the Library uses (edit, delete, watch) refuse. Creating a company, title, skill, role or activity type on the fly from a form stays open |

## Adding a switch

1. Add the key and its default to `FEATURES`; texts for Settings → «Функції» in both languages.
2. Hide the menu items and page blocks, answer 404 on its pages, and make **every** server action that changes the
   area refuse while it is off.
3. Tests: "off" switches off **only this key** (the others on), with a paired "on" case — a mock that answers "off"
   for any key stays green when the code checks the wrong switch. Typed `FeatureFlags` literals in older tests will
   need the new key (`npx tsc --noEmit` shows them).
