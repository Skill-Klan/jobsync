// @vitest-environment node
// Requirement — product notes, 2026-11-02: a student's plan is shown as
// module → topic → subtopic → point, in the template's order, with progress
// counted from the ticks:
//   · only points and homework tasks are counted — a module, a topic, a group,
//     a homework and a pointer to another topic's homework are not;
//   · a part with nothing to tick is 0%, never NaN;
//   · percent is whole, rounded to the nearest.
import { buildPlanTree, progressOf, type PlanItemView, type PlanRow } from "@/skillklan/plans/tree";

const row = (id: string, parentId: string | null, kind: string, position: number, done = false): PlanRow => ({
  id, parentId, kind, title: id, position, materialUrl: null, done, note: null,
});
const leaf = (kind: PlanItemView["kind"], done: boolean): PlanItemView => ({
  id: "x", kind, title: "x", materialUrl: null, done, note: null, children: [],
});

describe("buildPlanTree", () => {
  it("nests by parent and orders siblings by position, whatever order the rows come in", () => {
    const tree = buildPlanTree([
      row("p2", "t", "item", 1),
      row("t", "m", "topic", 0),
      row("p1", "t", "item", 0),
      row("m2", null, "module", 1),
      row("m", null, "module", 0),
    ]);
    expect(tree.map((m) => m.id)).toEqual(["m", "m2"]);
    expect(tree[0].children.map((t) => t.id)).toEqual(["t"]);
    expect(tree[0].children[0].children.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("an empty plan is an empty list", () => {
    expect(buildPlanTree([])).toEqual([]);
  });
});

describe("progressOf", () => {
  it("counts points and homework tasks only: 2 of 5 is 40%", () => {
    const topic: PlanItemView = {
      ...leaf("topic", false),
      children: [
        leaf("item", true),
        leaf("item", false),
        { ...leaf("group", false), children: [leaf("item", false)] },
        { ...leaf("homework", false), children: [leaf("homework_task", true), leaf("homework_task", false)] },
        leaf("homework_ref", false),
      ],
    };
    expect(progressOf(topic)).toEqual({ done: 2, total: 5, percent: 40 });
  });

  it("a ticked group, homework or pointer adds nothing — only its parts do", () => {
    const topic: PlanItemView = {
      ...leaf("topic", false),
      children: [leaf("group", true), leaf("homework", true), leaf("homework_ref", true), leaf("item", false)],
    };
    expect(progressOf(topic)).toEqual({ done: 0, total: 1, percent: 0 });
  });

  it("nothing to tick is 0%, not NaN", () => {
    expect(progressOf({ ...leaf("topic", false), children: [leaf("homework_ref", false)] })).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("rounds to a whole percent: 1 of 3 is 33%, 2 of 3 is 67%", () => {
    const three = (a: boolean, b: boolean, c: boolean): PlanItemView => ({
      ...leaf("topic", false),
      children: [leaf("item", a), leaf("item", b), leaf("item", c)],
    });
    expect(progressOf(three(true, false, false)).percent).toBe(33);
    expect(progressOf(three(true, true, false)).percent).toBe(67);
    expect(progressOf(three(true, true, true)).percent).toBe(100);
  });
});
