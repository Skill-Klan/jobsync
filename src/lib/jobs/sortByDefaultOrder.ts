// The lists a person picks from — statuses, job sources — are rows in
// insertion order, and a migration may add some after the rest. They are shown
// in the order of the seeded defaults (the constant list that seeds them);
// rows that are not defaults (created by the person) follow, as they came.
// Array.prototype.sort is stable, so ties keep their order. Returns a copy.
export function sortByDefaultOrder<T extends { value: string }>(
  items: readonly T[],
  defaults: readonly { value: string }[],
): T[] {
  const order = new Map(defaults.map((d, i) => [d.value, i]));
  const rank = (value: string) => order.get(value) ?? defaults.length;
  return [...items].sort((a, b) => rank(a.value) - rank(b.value));
}
