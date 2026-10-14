import { checkCabinetAccess } from "./cabinetApi";

// One backend answer per person per moment. Once a session's 5-minute window
// has passed, every auth() call while rendering one page — middleware,
// layout, page, server components — reads the same stale cookie and would ask
// the backend on its own: 12 calls for one page load on the dev server
// (2026-10-14), and 12 chances for one slow answer to end the session.
// Calls for the same person within ACCESS_SHARE_MS share one answer.
//
// The shared answer keeps the time its check started, so the 5-minute bound
// on revocation still counts from a real backend answer, not from the moment
// someone reused it.
//
// Kept on globalThis: middleware and the app render are separate bundles in
// one Node process, and a module-level map would exist once per bundle.

export const ACCESS_SHARE_MS = 30 * 1000;

type SharedCheck = { startedAt: number; allowed: Promise<boolean> };

declare const globalThis: {
  skillklanSharedAccessChecks?: Map<number, SharedCheck>;
} & typeof global;

const checks = (globalThis.skillklanSharedAccessChecks ??= new Map());

export async function recheckCabinetAccess(
  cabinetUserId: number,
): Promise<{ allowed: boolean; checkedAt: number }> {
  const now = Date.now();
  for (const [id, check] of checks) {
    if (now - check.startedAt >= ACCESS_SHARE_MS) checks.delete(id);
  }

  let shared = checks.get(cabinetUserId);
  if (!shared) {
    shared = {
      startedAt: now,
      allowed: checkCabinetAccess(cabinetUserId).catch(() => false),
    };
    checks.set(cabinetUserId, shared);
  }
  return { allowed: await shared.allowed, checkedAt: shared.startedAt };
}
