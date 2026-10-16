// SkillKlan feature switches (owner 2026-10-16): an admin turns parts of
// SkillKlan Job on or off for everyone in Settings → «Функції».
//
// The list of switches and their defaults live here, in code; the database
// (FeatureToggle) keeps only the admin's choice, and no row means the default.
//
// A switch hides a part of the interface for everyone — the admin included,
// so the admin sees what students see and turns it back on when needed. It
// never deletes data: switched back on, everything recorded is still there.
//
// Pure and shared by server and browser code: the server resolves the flags,
// the dashboard layout hands them to the browser (src/context/FeaturesContext).

export const FEATURES = {
  // Time tracking: the Activities tab and page, the running-activity banner,
  // "start activity" in Tasks, and the dashboard's hours, activity chart,
  // activity calendar, activity goal and recent activities. Off at launch.
  activities: { default: false },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export type FeatureFlags = Record<FeatureKey, boolean>;

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

// Own keys only: `"toString" in FEATURES` is true through the prototype.
export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FEATURES, value);
}

export function resolveFeatureFlags(
  rows: readonly { key: string; enabled: boolean }[],
): FeatureFlags {
  const flags = Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, FEATURES[key].default]),
  ) as FeatureFlags;
  // A row for a switch that is no longer in the list is ignored, not an error.
  for (const row of rows) {
    if (isFeatureKey(row.key)) flags[row.key] = row.enabled === true;
  }
  return flags;
}

// Everything on: what a component sees when rendered outside the dashboard
// layout (isolated renders, tests). In the app the layout always provides the
// resolved flags.
export const ALL_FEATURES_ON = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, true]),
) as FeatureFlags;
