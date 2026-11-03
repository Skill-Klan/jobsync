import { canonicalizeEntityValue } from "@/lib/jobs/canonicalize";

// The shared catalog (owner 2026-11-03): one list of skills, companies, job
// titles, locations and job sources that everybody picks from in the job form,
// changed only by whoever manages SkillKlan Job. Pure and shared by the server
// and the browser.
export const CATALOG_KINDS = ["skill", "company", "jobTitle", "location", "jobSource"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export function isCatalogKind(value: unknown): value is CatalogKind {
  return typeof value === "string" && (CATALOG_KINDS as readonly string[]).includes(value);
}

export const CATALOG_LABEL_MIN = 2;
export const CATALOG_LABEL_MAX = 80;

export type CatalogEntryView = { id: string; kind: CatalogKind; label: string; value: string };

// What a picker lists: a row of the person's own list, or (id `catalog:…`) an
// entry of the catalog the person has not used yet — it becomes their own row
// the moment they pick it.
export type PickerOption = { id: string; label: string; value: string };

export const CATALOG_ID_PREFIX = "catalog:";
export const isCatalogOptionId = (id: string) => id.startsWith(CATALOG_ID_PREFIX);
export const catalogEntryIdOf = (optionId: string) => optionId.slice(CATALOG_ID_PREFIX.length);

// The key of an entry — the same canonical form the person's own rows use, so
// "Java" typed by hand and "Java" from the catalog are one row.
export function catalogValue(kind: CatalogKind, label: string): string {
  return canonicalizeEntityValue(label.trim(), { stripLegalSuffix: kind === "company" });
}

// A label the catalog accepts: trimmed, 2 to 80 characters, with a key left.
export function cleanCatalogLabel(kind: CatalogKind, label: unknown): { label: string; value: string } | null {
  if (typeof label !== "string") return null;
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (trimmed.length < CATALOG_LABEL_MIN || trimmed.length > CATALOG_LABEL_MAX) return null;
  const value = catalogValue(kind, trimmed);
  return value ? { label: trimmed, value } : null;
}

// What a picker shows for one kind: every catalog entry — as the person's own
// row when they already have one with that key, otherwise as a `catalog:` entry
// — and nothing else, except the rows the form currently holds (`keep`: an
// older job keeps showing what it was saved with). Sorted by label.
export function mergeCatalogOptions(
  own: readonly PickerOption[],
  entries: readonly { id: string; label: string; value: string }[],
  keep: readonly (string | undefined)[] = [],
): PickerOption[] {
  const byValue = new Map(own.map((row) => [row.value, row]));
  const options: PickerOption[] = entries.map((entry) => {
    const row = byValue.get(entry.value);
    return row
      ? { id: row.id, label: entry.label, value: entry.value }
      : { id: `${CATALOG_ID_PREFIX}${entry.id}`, label: entry.label, value: entry.value };
  });
  for (const keepId of keep) {
    if (!keepId || options.some((o) => o.id === keepId)) continue;
    const kept = own.find((row) => row.id === keepId);
    if (kept) options.push(kept);
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
