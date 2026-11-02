import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { getPlanTemplate, PlanNode } from "./template";

export type AssignPlanResult =
  | { ok: true; planId: string; items: number }
  | { ok: false; reason: "unknown_track" | "unknown_user" | "already_assigned" };

type Row = Prisma.PlanItemCreateManyInput;

// Parents come before their children, so every row finds its parent already stored.
function flatten(planId: string, nodes: PlanNode[], parentId: string | null, out: Row[]): void {
  nodes.forEach((node, position) => {
    const id = randomUUID();
    out.push({ id, planId, parentId, kind: node.kind, title: node.title, position, materialUrl: node.materialUrl ?? null });
    flatten(planId, node.children ?? [], id, out);
  });
}

const CHUNK = 200;

// Gives a student their own copy of the track's template, frozen as it is now.
// Who may call this is the caller's business (the admin screen checks the role).
export async function assignPlan(db: PrismaClient, userId: string, track: string): Promise<AssignPlanResult> {
  const template = getPlanTemplate(track);
  if (!template) return { ok: false, reason: "unknown_track" };
  try {
    return await db.$transaction(async (tx) => {
      if (!(await tx.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
        return { ok: false, reason: "unknown_user" } as const;
      }
      if (await tx.plan.findUnique({ where: { userId_track: { userId, track } }, select: { id: true } })) {
        return { ok: false, reason: "already_assigned" } as const;
      }
      const plan = await tx.plan.create({ data: { userId, track, title: template.title } });
      const rows: Row[] = [];
      flatten(plan.id, template.children, null, rows);
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx.planItem.createMany({ data: rows.slice(i, i + CHUNK) });
      }
      return { ok: true, planId: plan.id, items: rows.length } as const;
    });
  } catch (e) {
    // Two requests at once: the unique (user, track) index lets only one through.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, reason: "already_assigned" };
    throw e;
  }
}
