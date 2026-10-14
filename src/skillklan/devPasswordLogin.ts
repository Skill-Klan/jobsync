// Password sign-in and sign-up are off in SkillKlan Job: people come in from
// the SkillKlan cabinet with a one-time code (src/skillklan/cabinetApi.ts).
// They stay available for local development and the Playwright suite only —
// behind an explicit flag AND never in a production build, so no environment
// variable on the server can turn them back on.
//
// Edge-safe: read by auth.config, which middleware loads.
export function isDevPasswordLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.JOBSYNC_DEV_PASSWORD_LOGIN === "1"
  );
}
