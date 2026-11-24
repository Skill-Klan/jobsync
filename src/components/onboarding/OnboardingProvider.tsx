"use client";
import { createContext, forwardRef, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes } from "react";
import { PlayCircle } from "lucide-react";
import { finishOnboarding, getOnboardingVideo } from "@/actions/onboarding.actions";
import { useTranslations } from "@/i18n/client";
import { toastError } from "@/lib/toast";
import type { OnboardingVideo } from "@/skillklan/onboarding/videos";
import { OnboardingVideoDialog } from "./OnboardingVideoDialog";

// The onboarding video around the dashboard (owner 2026-11-24, D118). `required` — the layout's answer: not
// watched yet and not the admin or the QA moderator. Then the video for this person (student or mentor, the
// backend says) opens by itself and must be watched to the end; once closed, it is recorded and not shown again.
// The profile menu replays it any time («Відео-огляд»).

const OnboardingContext = createContext<{ openReplay: () => void }>({ openReplay: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);

type Showing = { video: OnboardingVideo; mandatory: boolean };

export function OnboardingProvider({ required, children }: { required: boolean; children: React.ReactNode }) {
  const t = useTranslations("onboarding");
  const [showing, setShowing] = useState<Showing | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!required) return;
    let alive = true;
    getOnboardingVideo()
      .then((result) => {
        // Not answered (the backend is away): nothing now, the next page asks again.
        if (alive && result.success) setShowing({ video: result.data.video, mandatory: true });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [required]);

  const openReplay = useCallback(() => {
    getOnboardingVideo()
      .then((result) => {
        if (result.success) setShowing((now) => now ?? { video: result.data.video, mandatory: false });
        else toastError(result.message);
      })
      .catch(() => toastError(t("unavailable")));
  }, [t]);

  const done = async () => {
    if (showing?.mandatory) {
      setBusy(true);
      const result = await finishOnboarding(showing.video).catch(() => null);
      setBusy(false);
      // Not saved: the window still closes (nobody is kept in it); it comes back on the next sign-in.
      if (!result?.success) toastError(result?.message ?? t("unavailable"));
    }
    setShowing(null);
  };

  return (
    <OnboardingContext.Provider value={{ openReplay }}>
      {children}
      {showing && (
        <OnboardingVideoDialog
          video={showing.video}
          mandatory={showing.mandatory}
          busy={busy}
          onDone={done}
          onClose={() => setShowing(null)}
        />
      )}
    </OnboardingContext.Provider>
  );
}

// «Відео-огляд» for the phone menu (a server component): the same replay as the profile menu's item. Props pass
// through, so `SheetClose asChild` still closes the menu on the same click.
export const OnboardingReplayButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function OnboardingReplayButton({ onClick, ...props }, ref) {
    const { openReplay } = useOnboarding();
    const t = useTranslations("account");
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        onClick={(e) => {
          onClick?.(e);
          openReplay();
        }}
      >
        <PlayCircle className="h-5 w-5" />
        {t("videoTour")}
      </button>
    );
  },
);
