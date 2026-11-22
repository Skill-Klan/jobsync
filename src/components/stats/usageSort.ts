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

const value = (row: TableRow, key: SortKey): number | string => {
  switch (key) {
    case "name":
      return row.name;
    case "lastSignIn":
      return row.lastSignIn ?? -Infinity;
    case "jobs":
      return row.jobs;
    case "resumes":
      return row.resumes;
    case "modules":
      // Closed first, then how many there are to close.
      return row.modulesClosed * 1000 + row.modulesTotal;
  }
};

export function sortRows(rows: TableRow[], key: SortKey, direction: SortDirection): TableRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a, key);
    const y = value(b, key);
    const order =
      typeof x === "string" && typeof y === "string" ? x.localeCompare(y, "uk") : x < y ? -1 : x > y ? 1 : 0;
    return order * sign || a.name.localeCompare(b.name, "uk");
  });
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
