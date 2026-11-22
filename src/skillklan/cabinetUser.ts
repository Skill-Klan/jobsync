import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { seedNewAccount } from "@/lib/account/seedNewAccount";
import type { CabinetIdentity } from "./cabinetApi";

// The SkillKlan Job account of a person who came in from the cabinet. One
// account per cabinet id (User.cabinetUserId, unique): the first sign-in
// creates and seeds it, later ones find it and keep the name in step with the
// cabinet. Every sign-in stamps lastLoginAt — the admin's "who uses SkillKlan
// Job" (skillklan/adminStats.ts).
//
// The backend sends no email on purpose (no personal data across the
// boundary), so the account gets a stable placeholder on the reserved
// `.invalid` TLD — the backup manifest uses the email as the owner's label —
// and an unusable random password: password sign-in is off.

export function cabinetEmail(cabinetUserId: number): string {
  return `cabinet-${cabinetUserId}@users.jobs.skillklan.invalid`;
}

const FALLBACK_NAME = "SkillKlan student";

export async function findOrCreateCabinetUser(identity: CabinetIdentity) {
  const name = identity.name.trim() || FALLBACK_NAME;

  const lastLoginAt = new Date();
  const existing = await prisma.user.findUnique({
    where: { cabinetUserId: identity.userId },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name, lastLoginAt },
    });
  }

  const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  try {
    // One transaction: an account that exists must also be seeded, or every
    // later sign-in would find it and never seed it.
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: cabinetEmail(identity.userId),
          password,
          cabinetUserId: identity.userId,
          lastLoginAt,
        },
      });
      await seedNewAccount(user.id, tx);
      return user;
    });
  } catch (error) {
    // Two first sign-ins at once: the unique cabinetUserId lets one through,
    // the other reads what it created.
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await prisma.user.findUnique({
        where: { cabinetUserId: identity.userId },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

// The account of a student who has not come in yet: made by an admin's import
// of their plan (src/skillklan/plans/importPlan.ts), so that a plan can exist
// before the first sign-in. Same account, same seeding, same placeholder email
// as a sign-in makes — the first real sign-in finds it by the cabinet id — but
// no login is stamped: lastLoginAt stays empty, so «who uses SkillKlan Job»
// does not count a person who has never opened it. An existing account is
// returned as it is.
export async function ensureCabinetUser(identity: Pick<CabinetIdentity, "userId" | "name">): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.user.findUnique({ where: { cabinetUserId: identity.userId }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const made = await tx.user.create({
        data: {
          name: identity.name.trim() || FALLBACK_NAME,
          email: cabinetEmail(identity.userId),
          password,
          cabinetUserId: identity.userId,
        },
      });
      await seedNewAccount(made.id, tx);
      return made;
    });
    return { id: user.id, created: true };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await prisma.user.findUnique({ where: { cabinetUserId: identity.userId }, select: { id: true } });
      if (winner) return { id: winner.id, created: false };
    }
    throw error;
  }
}
