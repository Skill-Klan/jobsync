"use client";
import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Pause, Play, X } from "lucide-react";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { ONBOARDING_VIDEO_FILES, type OnboardingVideo } from "@/skillklan/onboarding/videos";

// The onboarding video (owner 2026-11-24, D118). Mandatory — the first sign-in: no way to close it, to skip or to
// seek ahead until the video ends; then «Все зрозуміло» in the middle of the screen closes it. Replay — from the
// profile menu: an ordinary window, closable at any moment, with the player's own controls.

const clock = (s: number) => {
  const total = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function OnboardingVideoDialog({
  video,
  mandatory,
  busy = false,
  onDone,
  onClose,
}: {
  video: OnboardingVideo;
  mandatory: boolean;
  busy?: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("onboarding");
  const ref = useRef<HTMLVideoElement>(null);
  // The furthest point reached by playing: seeking past it is undone while the video is mandatory.
  const watched = useRef(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState({ at: 0, of: 0 });
  const files = ONBOARDING_VIDEO_FILES[video];

  const play = () => {
    setStarted(true);
    try {
      void ref.current?.play()?.catch(() => setPlaying(false));
    } catch {
      setPlaying(false);
    }
  };
  const toggle = () => (playing ? ref.current?.pause() : play());
  // While mandatory, Escape and a click outside do nothing.
  const hold = (e: Event) => {
    if (mandatory) e.preventDefault();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && !mandatory && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={hold}
          onPointerDownOutside={hold}
          onInteractOutside={hold}
          className="fixed left-1/2 top-1/2 z-50 w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-3 shadow-lg sm:p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="text-base font-semibold">{t("title")}</DialogPrimitive.Title>
            {!mandatory && (
              <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring">
                <X className="h-4 w-4" />
                <span className="sr-only">{t("close")}</span>
              </DialogPrimitive.Close>
            )}
          </div>
          <div className="relative overflow-hidden rounded-md bg-black">
            <video
              ref={ref}
              src={files.src}
              poster={files.poster}
              playsInline
              preload="metadata"
              controls={!mandatory && started}
              className="block aspect-video w-full"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (!v.seeking) watched.current = Math.max(watched.current, v.currentTime);
                setTime({ at: v.currentTime, of: v.duration || 0 });
              }}
              onSeeking={(e) => {
                const v = e.currentTarget;
                if (mandatory && v.currentTime > watched.current + 1) v.currentTime = watched.current;
              }}
              onEnded={() => {
                setPlaying(false);
                setEnded(true);
              }}
            />
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Button size="lg" className="h-14 gap-2 rounded-full px-8 text-lg" onClick={play}>
                  <Play className="h-5 w-5" />
                  {t("play")}
                </Button>
              </div>
            )}
            {ended && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <Button size="lg" className="h-14 rounded-full px-10 text-lg" disabled={busy} onClick={onDone}>
                  {t("done")}
                </Button>
              </div>
            )}
          </div>
          {mandatory && started && !ended && (
            <div className="mt-3 flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={toggle}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? t("pause") : t("resume")}
              </Button>
              <div
                role="progressbar"
                aria-label={t("title")}
                aria-valuemin={0}
                aria-valuemax={Math.round(time.of)}
                aria-valuenow={Math.round(time.at)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary" style={{ width: `${time.of ? (time.at / time.of) * 100 : 0}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {clock(time.at)} / {clock(time.of)}
              </span>
            </div>
          )}
          {mandatory && !ended && <p className="mt-2 text-xs text-muted-foreground">{t("mustWatch")}</p>}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
