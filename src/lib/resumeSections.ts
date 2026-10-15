import { APP_CONSTANTS } from "@/lib/constants";

export const hasMinResumeSections = (
  sectionCount: number | null | undefined,
): boolean =>
  (sectionCount ?? 0) >= APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;

// The `min` value for the common.resumeSections messages — the texts that say
// why a resume with too few sections can't be used.
export const MIN_SECTIONS = {
  min: APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION,
};
