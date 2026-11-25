import "server-only";
import prisma from "@/lib/db";
import { auth } from "@/auth";
import { getViewerMentor } from "@/skillklan/cabinetApi";
import { sharedAnswer, viewerCabinetId } from "@/skillklan/mentorPlans";
import { parseOnboardingRecord, type OnboardingRecord, type OnboardingVideo } from "./videos";

// Whether a person has watched the onboarding video (D118): kept in their own settings (UserSettings.settings,
// `onboarding`), next to the daily goals — no table of its own. Both settings writers spread the stored JSON, so
// a later change of the theme or the goals keeps it (__tests__/skillklan/onboarding.spec.ts holds them to it).

async function readSettings(userId: string): Promise<Record<string, unknown> | null> {
  const row = await prisma.userSettings.findUnique({ where: { userId }, select: { settings: true } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.settings);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export async function readOnboarding(userId: string): Promise<OnboardingRecord | null> {
  return parseOnboardingRecord((await readSettings(userId))?.onboarding);
}

// Must the video open by itself on this page (D118)? Until it is watched to the end and closed — and never for
// the admin or the QA moderator (they manage the app; the menu replays it for them).
export async function onboardingRequired(userId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return false;
  return (await readOnboarding(userId)) === null;
}

// Watched to the end and closed: from now on the video is not shown by itself. The first time stays.
export async function recordOnboarding(userId: string, video: OnboardingVideo, now = new Date()): Promise<void> {
  const settings = (await readSettings(userId)) ?? {};
  if (parseOnboardingRecord(settings.onboarding)) return;
  const json = JSON.stringify({ ...settings, onboarding: { video, finishedAt: now.toISOString() } });
  await prisma.userSettings.upsert({ where: { userId }, update: { settings: json }, create: { userId, settings: json } });
}

// Which video this person gets. A mentor is the backend's answer, not a role (D89, contract:
// docs/contracts/study-plans-mentors.md) — the same shared answer the study plan asks for. Anyone else, and an
// account without a cabinet id (development only), gets the student's. `null` — the backend did not answer:
// show nothing now and ask again on the next page, rather than show a mentor the student's video.
export async function videoForViewer(): Promise<OnboardingVideo | null> {
  if (!(await auth())?.user?.id) return null;
  const viewer = await viewerCabinetId();
  if (viewer === null) return "student";
  const answer = await sharedAnswer(`${viewer}:me`, () => getViewerMentor(viewer));
  if (answer === null) return null;
  return answer.mentor ? "mentor" : "student";
}
