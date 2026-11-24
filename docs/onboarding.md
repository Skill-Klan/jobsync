# Onboarding video

At the first sign-in a person watches a short video of the app — one for a student, one for a mentor — to the end,
then closes it with «Все зрозуміло» in the middle of the screen. It does not come back by itself; the menu replays it
(«Відео-огляд»). The owner's decisions: [D115, D118](./decisions.md#onboarding-video).

## How it works

| Piece | Where |
|---|---|
| The videos and their posters | `public/onboarding/student.mp4`, `mentor.mp4`, `student.jpg`, `mentor.jpg` |
| Which files belong to which video | `src/skillklan/onboarding/videos.ts` |
| Must it open, which video, «watched» | `src/skillklan/onboarding/state.ts`, `src/actions/onboarding.actions.ts` |
| The window, the replay | `src/components/onboarding/` — `OnboardingProvider` wraps the dashboard (`src/app/dashboard/layout.tsx`) |
| «Відео-огляд» in the menus | `src/components/ProfileDropdown.tsx`, the phone menu in `src/components/Header.tsx` |

- **Must it open.** The layout asks `onboardingRequired(user, isAdmin)`: not the admin or the QA moderator, and not
  watched yet. Only the person's own settings are read — no backend call on the render path.
- **Which video** is asked from the browser after the page is up (`getOnboardingVideo`): a mentor is the backend's
  answer (`GET /api/jobsync/users/:viewer/mentor`, [contract](./contracts/study-plans-mentors.md)), shared for 30 s with
  the study plan; anyone else, and a development account without a cabinet id, gets the student's. The backend does
  not answer → nothing opens now, the next page asks again (a mentor is never shown the student's video by guess).
- **Mandatory.** No close button; Escape and a click outside do nothing (two guards: the events are cancelled and the
  window refuses to close); no seek bar, and a seek past the furthest point played is undone. Pause and resume work.
  When the video ends, «Все зрозуміло» appears over it, centred.
- **Watched** is `onboarding: { video, finishedAt }` in the person's `UserSettings.settings`, next to the daily goals —
  no table of its own. Both other writers of the settings spread the stored JSON, so changing the theme or the goals
  keeps it; `__tests__/skillklan/onboarding.spec.ts` holds them to it. The first time is kept.
- **Not saved** (the server refused): the window still closes and the person is told; it opens again next time.
- **Replay** from the menu: an ordinary window with the player's own controls, closable any time; nothing recorded.

## Replacing a video

The videos are recorded on invented demo data (no real students, companies or recordings) and voiced; they show
the interface as it is, so a visible change to a screen they show means recording that part again. Replace the
file under the same name in `public/onboarding/` (H.264 + AAC, `faststart`, 1920×1080; a few MB) and its poster
(the first frame). The names are in `videos.ts`; nothing else refers to the files.

## Tests

`__tests__/skillklan/onboarding.spec.ts` (who must watch, which video, «watched» kept, refusals — real SQLite and the
backend stand-in), `onboardingUi.spec.tsx` (the window: no way out before the end, seek undone, «Все зрозуміло»,
replay), `onboardingMenus.spec.tsx` (both menus), `onboardingLayout.spec.tsx` (the layout's answer).
