// Requirement — the owner, 2026-11-22 (SKD-66): clicking a column header of the
// statistics list sorts by it, ascending or descending. A person who never
// signed in counts as the oldest sign-in; equal values keep a steady order by
// name; a first click starts with the biggest (a name: A to Z), a second flips.
import { nextSort, sortRows, type TableRow } from "@/components/stats/usageSort";

const row = (name: string, over: Partial<TableRow> = {}): TableRow => ({
  id: name,
  name,
  lastSignIn: null,
  lastSignInLabel: null,
  jobs: 0,
  resumes: 0,
  resumesWithFile: 0,
  modulesClosed: 0,
  modulesTotal: 0,
  ...over,
});
const names = (rows: TableRow[]) => rows.map((r) => r.name);

describe("sortRows", () => {
  const rows = [row("Ann", { jobs: 5 }), row("Bob", { jobs: 31 }), row("Cat", { jobs: 0 }), row("Dan", { jobs: 5 })];

  it("vacancies, descending and ascending; equal counts by name", () => {
    expect(names(sortRows(rows, "jobs", "desc"))).toEqual(["Bob", "Ann", "Dan", "Cat"]);
    expect(names(sortRows(rows, "jobs", "asc"))).toEqual(["Cat", "Ann", "Dan", "Bob"]);
  });

  it("last sign-in: never is the oldest", () => {
    const people = [row("Never"), row("Old", { lastSignIn: 1000 }), row("New", { lastSignIn: 9000 })];
    expect(names(sortRows(people, "lastSignIn", "desc"))).toEqual(["New", "Old", "Never"]);
    expect(names(sortRows(people, "lastSignIn", "asc"))).toEqual(["Never", "Old", "New"]);
  });

  it("modules: more closed first; with the same closed, the one with more to close", () => {
    const people = [
      row("Few", { modulesClosed: 2, modulesTotal: 9 }),
      row("Many", { modulesClosed: 7, modulesTotal: 9 }),
      row("NoPlan"),
      row("Two of four", { modulesClosed: 2, modulesTotal: 4 }),
    ];
    expect(names(sortRows(people, "modules", "desc"))).toEqual(["Many", "Few", "Two of four", "NoPlan"]);
  });

  it("name, in Ukrainian order; the input is not changed", () => {
    const people = [row("Юлія"), row("Андрій"), row("Євгенія")];
    expect(names(sortRows(people, "name", "asc"))).toEqual(["Андрій", "Євгенія", "Юлія"]);
    expect(names(people)).toEqual(["Юлія", "Андрій", "Євгенія"]);
  });
});

describe("nextSort", () => {
  it("a new column starts biggest first; a name A to Z", () => {
    expect(nextSort(null, "jobs")).toEqual({ key: "jobs", direction: "desc" });
    expect(nextSort({ key: "jobs", direction: "asc" }, "name")).toEqual({ key: "name", direction: "asc" });
  });

  it("the same column flips, and flips back", () => {
    const first = nextSort(null, "jobs");
    const second = nextSort(first, "jobs");
    expect(second).toEqual({ key: "jobs", direction: "asc" });
    expect(nextSort(second, "jobs")).toEqual({ key: "jobs", direction: "desc" });
  });
});
