// Sorting the statistics list by a column the admin clicks (SKD-66). Pure, so it
// is tested apart from the table. A person never signed in sorts as the oldest
// sign-in; equal values keep a steady order by name.
export type SortKey = "name" | "lastSignIn" | "jobs" | "resumes" | "modules";
export type SortDirection = "asc" | "desc";

export type TableRow = {
  id: string;
  name: string;
  lastSignIn: number | null; // ms since epoch
  lastSignInLabel: string | null; // already formatted by the server
  jobs: number;
  resumes: number;
  resumesWithFile: number;
  modulesClosed: number;
  modulesTotal: number;
};

const text = (a: string, b: string) => a.localeCompare(b, "uk");
const num = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

function compare(a: TableRow, b: TableRow, key: SortKey): number {
  switch (key) {
    case "name":
      return text(a.name, b.name);
    case "lastSignIn":
      return num(a.lastSignIn ?? -Infinity, b.lastSignIn ?? -Infinity);
    case "jobs":
      return num(a.jobs, b.jobs);
    case "resumes":
      return num(a.resumes, b.resumes);
    case "modules":
      // More closed first; with the same closed, the plan with more modules to go.
      return num(a.modulesClosed, b.modulesClosed) || num(a.modulesTotal, b.modulesTotal);
  }
}

export function sortRows(rows: TableRow[], key: SortKey, direction: SortDirection): TableRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compare(a, b, key) * sign || text(a.name, b.name));
}

// Clicking a column: a new column starts with the biggest first (a name — A to Z);
// the same column again flips the direction.
export function nextSort(
  current: { key: SortKey; direction: SortDirection } | null,
  key: SortKey,
): { key: SortKey; direction: SortDirection } {
  if (current?.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "name" ? "asc" : "desc" };
}
