// @vitest-environment node
// Requirement — the lists a person picks from (statuses, job sources) show
// the seeded defaults in the owner's order, whatever order the rows were
// inserted in (a migration adds some after the rest); what is not a default
// (created by the person) follows, in the order it came.
import { sortByDefaultOrder } from "@/lib/jobs/sortByDefaultOrder";

const DEFAULTS = [{ value: "a" }, { value: "b" }, { value: "c" }];

describe("sortByDefaultOrder", () => {
  it("puts the defaults in their order, however they arrive", () => {
    const rows = [{ value: "c" }, { value: "a" }, { value: "b" }];
    expect(sortByDefaultOrder(rows, DEFAULTS).map((r) => r.value)).toEqual(["a", "b", "c"]);
  });

  it("puts what is not a default after them, in the order it came", () => {
    const rows = [{ value: "z" }, { value: "c" }, { value: "y" }, { value: "a" }, { value: "x" }];
    expect(sortByDefaultOrder(rows, DEFAULTS).map((r) => r.value)).toEqual(["a", "c", "z", "y", "x"]);
  });

  it("keeps everything else on the rows, and leaves the input as it was", () => {
    const rows = [
      { value: "b", id: 1, label: "B" },
      { value: "a", id: 2, label: "A" },
    ];
    const sorted = sortByDefaultOrder(rows, DEFAULTS);
    expect(sorted).toEqual([
      { value: "a", id: 2, label: "A" },
      { value: "b", id: 1, label: "B" },
    ]);
    expect(rows.map((r) => r.value)).toEqual(["b", "a"]);
  });

  it("an empty list stays empty; with no defaults the order is as it came", () => {
    expect(sortByDefaultOrder([], DEFAULTS)).toEqual([]);
    expect(sortByDefaultOrder([{ value: "q" }, { value: "p" }], []).map((r) => r.value)).toEqual(["q", "p"]);
  });
});
