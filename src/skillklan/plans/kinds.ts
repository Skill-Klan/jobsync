// The kinds of row a plan is made of. Kept apart from the template so the
// browser can count progress without loading the whole template file.
export const PLAN_KINDS = [
  "module",
  "topic",
  "group",
  "item",
  "homework",
  "homework_task",
  "homework_ref",
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

// What a student can tick. A group, a homework and a module are done by their parts.
export const TICKABLE_KINDS: readonly PlanKind[] = ["item", "homework_task"];
