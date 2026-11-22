import type { PrismaClient } from "@prisma/client";
import { assignPlan } from "./assignPlan";
import { matchPassed, type PassedRow, type StudentTab, type TemplatePoint } from "./sheetImport";

export type ImportOutcome = {
  planCreated: boolean;
  marked: number;
  alreadyDone: number;
  missing: PassedRow[];
};

// The points of a plan with the topic each one sits under, in the plan's
// reading order (module → topic → group → point).
export async function planPoints(db: PrismaClient, planId: string): Promise<TemplatePoint[]> {
  const rows = await db.planItem.findMany({
    where: { planId },
    select: { id: true, parentId: true, kind: true, title: true, position: true, done: true },
  });
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  const out: TemplatePoint[] = [];
  const walk = (parent: string | null, topic: string) => {
    for (const r of (byParent.get(parent) ?? []).sort((a, b) => a.position - b.position)) {
      if (r.kind === "item") out.push({ id: r.id, topic, text: r.title, done: r.done });
      walk(r.id, r.kind === "topic" ? r.title : topic);
    }
  };
  walk(null, "");
  return out;
}

const CHUNK = 200;

// Gives the account the track's plan when it has none, and ticks the points the
// tab marks as passed. Nothing is ever unticked, and a tick that is there stays
// as it is (its date included): running the same import twice changes nothing
// the second time.
export async function importTabIntoPlan(
  db: PrismaClient,
  userId: string,
  track: string,
  tab: StudentTab,
): Promise<ImportOutcome> {
  let plan = await db.plan.findUnique({ where: { userId_track: { userId, track } }, select: { id: true } });
  let planCreated = false;
  if (!plan) {
    const result = await assignPlan(db, userId, track);
    if (!result.ok && result.reason !== "already_assigned") throw new Error(`plan not given: ${result.reason}`);
    plan = await db.plan.findUniqueOrThrow({ where: { userId_track: { userId, track } }, select: { id: true } });
    planCreated = result.ok;
  }
  const { ids, alreadyDone, missing } = matchPassed(await planPoints(db, plan.id), tab.rows);
  const now = new Date();
  for (let i = 0; i < ids.length; i += CHUNK) {
    await db.planItem.updateMany({ where: { id: { in: ids.slice(i, i + CHUNK) }, done: false }, data: { done: true, doneAt: now } });
  }
  return { planCreated, marked: ids.length, alreadyDone, missing };
}
