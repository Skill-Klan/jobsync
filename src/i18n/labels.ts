import {
  CONTACT_ROLES,
  DISCOVERY_STATUSES,
  JOB_SOURCES,
  JOB_STAGES,
  JOB_STATUSES,
  STAGE_OUTCOMES,
} from "@/lib/constants";

// Statuses, stages, contact roles and job sources are rows in the database,
// seeded in English (seedNewAccount). They are translated when shown, by their
// `value`, which never changes — the stored label stays English, so switching
// the language needs no migration. A label the person renamed, or an item they
// created, is theirs and is shown exactly as stored. Brand sources (LinkedIn,
// Indeed…) have no translation and are shown as stored, too.

export type LabelKind =
  | "jobStatus"
  | "jobStage"
  | "stageOutcome"
  | "contactRole"
  | "jobSource"
  | "discoveryStatus";

const defaults = (items: readonly { label: string; value: string }[]) =>
  new Map(items.map((i) => [i.value, i.label]));

export const DEFAULT_LABELS: Record<LabelKind, Map<string, string>> = {
  jobStatus: defaults(JOB_STATUSES),
  jobStage: defaults(JOB_STAGES),
  stageOutcome: defaults(STAGE_OUTCOMES),
  contactRole: defaults(CONTACT_ROLES),
  jobSource: defaults(JOB_SOURCES),
  discoveryStatus: defaults(DISCOVERY_STATUSES),
};

/** The `labels` translator: t(`${kind}.${value}`) plus t.has. */
export type LabelsTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

export function labelFor(
  t: LabelsTranslator,
  kind: LabelKind,
  item: { value: string; label?: string | null },
): string {
  const stored = item.label ?? item.value;
  const englishDefault = DEFAULT_LABELS[kind].get(item.value);
  // Not one of ours, or renamed by the person — theirs, as is.
  if (englishDefault === undefined || (item.label != null && item.label !== englishDefault)) return stored;
  const key = `${kind}.${item.value}`;
  return t.has(key) ? t(key) : stored;
}
