import { hasMinResumeSections } from "@/lib/resumeSections";
import { APP_CONSTANTS } from "@/lib/constants";

describe("hasMinResumeSections", () => {
  it("returns false below the minimum", () => {
    expect(hasMinResumeSections(0)).toBe(false);
    expect(
      hasMinResumeSections(APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION - 1),
    ).toBe(false);
  });

  it("returns true at or above the minimum", () => {
    expect(
      hasMinResumeSections(APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION),
    ).toBe(true);
    expect(
      hasMinResumeSections(APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION + 1),
    ).toBe(true);
  });

  it("treats null/undefined as zero sections", () => {
    expect(hasMinResumeSections(null)).toBe(false);
    expect(hasMinResumeSections(undefined)).toBe(false);
  });
});

// The texts themselves (minimum, action, attachment) are checked where they
// are shown: IncompleteResumeHint, resumeSections.utils, the profile actions.
