// The onboarding videos (owner 2026-11-24, docs/decisions.md D115–D118): one for a student, one for a mentor.
// Recorded on invented demo data and voiced; the files live in public/onboarding/. Pure — the browser uses it too.

export const ONBOARDING_VIDEOS = ["student", "mentor"] as const;
export type OnboardingVideo = (typeof ONBOARDING_VIDEOS)[number];

export const ONBOARDING_VIDEO_FILES: Record<OnboardingVideo, { src: string; poster: string }> = {
  student: { src: "/onboarding/student.mp4", poster: "/onboarding/student.jpg" },
  mentor: { src: "/onboarding/mentor.mp4", poster: "/onboarding/mentor.jpg" },
};

export function isOnboardingVideo(value: unknown): value is OnboardingVideo {
  return typeof value === "string" && (ONBOARDING_VIDEOS as readonly string[]).includes(value);
}

// What a person's settings keep once the video is watched to the end and closed: which one, and when.
export type OnboardingRecord = { video: OnboardingVideo; finishedAt: string };

export function parseOnboardingRecord(raw: unknown): OnboardingRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { video, finishedAt } = raw as { video?: unknown; finishedAt?: unknown };
  if (!isOnboardingVideo(video) || typeof finishedAt !== "string" || Number.isNaN(Date.parse(finishedAt))) return null;
  return { video, finishedAt };
}
