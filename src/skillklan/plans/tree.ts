import { type PlanKind, TICKABLE_KINDS } from "./kinds";

// What the page needs of a student's plan: the stored rows as a tree, and how
// far along each part is. Pure, shared by the server and the browser.
export const PLAN_NOTE_MAX = 2000;

export interface PlanItemView {
  id: string;
  kind: PlanKind;
  title: string;
  materialUrl: string | null;
  done: boolean;
  note: string | null;
  children: PlanItemView[];
}

export interface PlanRow {
  id: string;
  parentId: string | null;
  kind: string;
  title: string;
  position: number;
  materialUrl: string | null;
  done: boolean;
  note: string | null;
}

export function buildPlanTree(rows: readonly PlanRow[]): PlanItemView[] {
  const byParent = new Map<string | null, PlanRow[]>();
  for (const row of rows) byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
  const grow = (parentId: string | null): PlanItemView[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        id: r.id,
        kind: r.kind as PlanKind,
        title: r.title,
        materialUrl: r.materialUrl,
        done: r.done,
        note: r.note,
        children: grow(r.id),
      }));
  return grow(null);
}

export interface Progress {
  done: number;
  total: number;
  // Whole percent; a part with nothing to tick is 0, not NaN.
  percent: number;
}

// Counts the points and homework tasks under a node, the node itself included.
export function progressOf(node: Pick<PlanItemView, "kind" | "done" | "children">): Progress {
  let done = 0;
  let total = 0;
  const visit = (n: Pick<PlanItemView, "kind" | "done" | "children">) => {
    if (TICKABLE_KINDS.includes(n.kind)) {
      total += 1;
      if (n.done) done += 1;
    }
    n.children.forEach(visit);
  };
  visit(node);
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
