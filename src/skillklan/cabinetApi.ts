// Calls to the SkillKlan backend for the cabinet login (contract: the
// backend's documentation/05-api/JOBSYNC_LOGIN_API.md):
//
//   exchangeLoginCode — trade the one-time code the cabinet posted for the
//                       person behind it;
//   getCabinetAccess — is that person still allowed in, and with which role
//                       (re-checked at least every 5 minutes, see auth.config);
//   checkCabinetAccess — the same, yes or no.
//
// Fail closed, always: missing configuration, a timeout, a non-200 answer or
// an answer of the wrong shape all mean "no". No retries — the exchange is not
// idempotent (the code burns on first use), and a check that failed is simply
// a sign-out, not something to hammer the backend about.
//
// Edge-safe (fetch only): auth.config runs it inside middleware.
// The code itself is never logged — while it is alive it proves who you are.

export const CABINET_API_TIMEOUT_MS = 5000;

// The roles the backend lets in (owner: students D22, the admin D23, the QA
// moderator D81 — 2026-10-19). Any other answer is no role.
export const CABINET_ROLES = ["student", "admin", "qa_moderator"] as const;
export type CabinetRole = (typeof CABINET_ROLES)[number];

export function isCabinetRole(value: unknown): value is CabinetRole {
  return typeof value === "string" && (CABINET_ROLES as readonly string[]).includes(value);
}

// Who manages SkillKlan Job for everyone — sees and changes Settings →
// «Функції»: the admin, and since 2026-10-19 the QA moderator too (owner,
// D81: "access the same as the admin's").
export function managesSkillklanJob(role: CabinetRole | null | undefined): boolean {
  return role === "admin" || role === "qa_moderator";
}

export type CabinetIdentity = {
  userId: number;
  role: CabinetRole;
  name: string;
};

// The role is the backend's (SkillKlan rules §1): SkillKlan Job keeps no copy
// of it, only the answer of the last check in the session token.
export type CabinetAccess = { allowed: boolean; role: CabinetRole | null };

const NO_ACCESS: CabinetAccess = { allowed: false, role: null };

function backend(): { base: string; secret: string } | null {
  const base = process.env.SKILLKLAN_API_URL;
  const secret = process.env.JOBSYNC_API_SECRET;
  if (!base || !secret) return null;
  return { base: base.replace(/\/+$/, ""), secret };
}

async function call(path: string, init: RequestInit): Promise<unknown | null> {
  const config = backend();
  if (!config) return null;
  // One deadline for the whole call — connect, answer and body.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CABINET_API_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.base}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), "x-jobsync-secret": config.secret },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status !== 200) return null;
    const body = (await res.json()) as { success?: unknown; data?: unknown };
    return body && body.success === true ? body.data ?? null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeLoginCode(code: string): Promise<CabinetIdentity | null> {
  if (typeof code !== "string" || code.length === 0) return null;
  const data = (await call("/api/jobsync/login-code/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  })) as Partial<CabinetIdentity> | null;
  if (
    !data ||
    !Number.isSafeInteger(data.userId) ||
    (data.userId as number) <= 0 ||
    !isCabinetRole(data.role)
  ) {
    return null;
  }
  return {
    userId: data.userId as number,
    role: data.role as CabinetRole,
    name: typeof data.name === "string" ? data.name : "",
  };
}

export async function getCabinetAccess(userId: number): Promise<CabinetAccess> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return NO_ACCESS;
  const data = (await call(`/api/jobsync/users/${userId}/access`, { method: "GET" })) as
    | { allowed?: unknown; role?: unknown }
    | null;
  if (!data || data.allowed !== true) return NO_ACCESS;
  // A role we do not know is no role — never read as one that manages.
  const role = isCabinetRole(data.role) ? data.role : null;
  return { allowed: true, role };
}

export async function checkCabinetAccess(userId: number): Promise<boolean> {
  return (await getCabinetAccess(userId)).allowed;
}
