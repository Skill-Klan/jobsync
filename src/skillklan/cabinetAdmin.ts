import "server-only";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getCabinetAccess, managesSkillklanJob } from "./cabinetApi";

// Who is a SkillKlan admin is the backend's to say (SkillKlan rules §1);
// SkillKlan Job keeps no copy of roles. "Admin" here is whoever manages
// SkillKlan Job: the admin and the QA moderator (owner 2026-10-19, D81).
//
// Seeing admin-only settings: the session's answer is enough — it comes from
// the backend's last access check, at most 5 minutes old (auth.config).
export async function isAdminSession(): Promise<boolean> {
  const session = await auth();
  return session?.user?.isAdmin === true;
}

// Changing something for everyone: ask the backend again, now. A token minted
// before a demotion still says "admin" for up to 5 minutes; this does not.
// Returns the admin's cabinet id (for "who changed it"), or null — no session,
// a dev-only password account, not an admin, or the backend did not answer
// (fail closed).
export async function confirmCabinetAdmin(): Promise<number | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cabinetUserId: true },
  });
  const cabinetUserId = user?.cabinetUserId;
  if (!cabinetUserId) return null;
  const access = await getCabinetAccess(cabinetUserId).catch(() => null);
  return access?.allowed === true && managesSkillklanJob(access.role) ? cabinetUserId : null;
}
