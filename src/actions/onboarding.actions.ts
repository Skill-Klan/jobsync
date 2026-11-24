"use server";
import { getTranslations } from "@/i18n/server";
import { getCurrentUser } from "@/utils/user.utils";
import { recordOnboarding, videoForViewer } from "@/skillklan/onboarding/state";
import { isOnboardingVideo, type OnboardingVideo } from "@/skillklan/onboarding/videos";

// The onboarding video (owner 2026-11-24, D118): which one this person gets, and «watched to the end and closed».
// Asked from the browser, not while rendering: telling a mentor needs the backend, and a render path never calls it.

type Result<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; message: string };

async function unavailable() {
  const t = await getTranslations("onboarding");
  return { success: false, message: t("unavailable") } as const;
}

export async function getOnboardingVideo(): Promise<Result<{ video: OnboardingVideo }>> {
  try {
    const video = await videoForViewer();
    return video ? { success: true, data: { video } } : await unavailable();
  } catch {
    return await unavailable();
  }
}

export async function finishOnboarding(video: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || !isOnboardingVideo(video)) return await unavailable();
  try {
    await recordOnboarding(user.id, video);
    return { success: true };
  } catch {
    return await unavailable();
  }
}
