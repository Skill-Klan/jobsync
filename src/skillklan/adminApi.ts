import "server-only";
import crypto from "crypto";

// The machine API the SkillKlan backend calls for the admin pages
// (contract: the backend's documentation/05-api/JOBSYNC_ADMIN_API.md).
//
// The routes live outside /api on purpose — like /auth/cabinet — so the
// session middleware never sees them: the caller is a server, not a person,
// and the secret below is the only way in.
//
// Fail closed: no secret configured (or one too short to be a real secret)
// is 503, a missing or wrong one is 401, and the comparison takes the same
// time whatever was sent. A separate secret from JOBSYNC_API_SECRET (which
// SkillKlan Job sends the backend): leaking one direction must not open the
// other. Nothing here is cacheable, and nothing is logged but the failure.

export const ADMIN_SECRET_HEADER = "x-jobsync-admin-secret";
export const ADMIN_SECRET_MIN_LENGTH = 32;

const NO_STORE = { "Cache-Control": "no-store" };

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

export function adminJson(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function adminData(data: Record<string, unknown>): Response {
  return adminJson(200, { success: true, data, error: null });
}

export function adminError(status: number, error: string): Response {
  return adminJson(status, { success: false, data: null, error });
}

/** null — the caller may go on; a Response — the refusal to send back. */
export function refuseUnlessAdminSecret(request: Request): Response | null {
  const secret = process.env.JOBSYNC_ADMIN_API_SECRET ?? "";
  if (secret.length < ADMIN_SECRET_MIN_LENGTH) {
    return adminError(503, "service_unavailable");
  }
  const given = request.headers.get(ADMIN_SECRET_HEADER) ?? "";
  // Hash both sides: timingSafeEqual needs equal lengths, and comparing
  // digests keeps the length of the real secret out of the timing too.
  if (!crypto.timingSafeEqual(sha256(given), sha256(secret))) {
    return adminError(401, "unauthorized");
  }
  return null;
}

const INT4_MAX = 2147483647;

/** A cabinet user id from a path segment, or null for anything else. */
export function parseCabinetUserId(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= INT4_MAX ? id : null;
}
