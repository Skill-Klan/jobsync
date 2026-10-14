import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  CONTACT_ROLES,
  JOB_SOURCES,
  JOB_STAGES,
  JOB_STATUSES,
} from "@/lib/constants";

// The defaults every new account starts with: job sources, contact roles,
// the shared job statuses and the per-user stage types that point at them.
// One function for every way an account is born — the cabinet login
// (src/skillklan/cabinetUser.ts) and the dev-only signup — so a student
// signed in from the cabinet gets exactly what a signed-up user got.
//
// `db` — a transaction client when the account must not exist half-seeded
// (the cabinet login creates the user and seeds it in one transaction).
export async function seedNewAccount(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.jobSource.createMany({
    data: JOB_SOURCES.map((source) => ({
      label: source.label,
      value: source.value,
      createdBy: userId,
    })),
  });

  await db.contactRole.createMany({
    data: CONTACT_ROLES.map((role) => ({
      label: role.label,
      value: role.value,
      createdBy: userId,
    })),
  });

  for (const status of JOB_STATUSES) {
    await db.jobStatus.upsert({
      where: { value: status.value },
      update: {},
      create: status,
    });
  }

  // Stage types point at JobStatus, so this must follow the upsert loop.
  const statusRows = await db.jobStatus.findMany({
    select: { id: true, value: true },
  });
  const statusIdByValue = new Map(statusRows.map((s) => [s.value, s.id]));
  await db.jobStageType.createMany({
    data: JOB_STAGES.map((stage) => ({
      label: stage.label,
      value: stage.value,
      statusId: statusIdByValue.get(stage.status)!,
      sortOrder: stage.sortOrder,
      createdBy: userId,
    })),
  });
}
