"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Copy, FileText, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslations } from "@/i18n/client";
import { clock, transcriptAsText, type TranscriptSegment } from "@/skillklan/transcripts/segments";

// «Транскрибувати» beside a recording (owner 2026-11-20, D104–D106, the mockup
// approved the same day): the button queues the recording and spins while it
// is being made; when the text is ready the panel below the recording opens by
// itself — the text with who speaks and when, «Копіювати». The transcript is
// kept for everyone: from then on the button is «Текст» and opens it at once.
//
// «Копіювати» puts the text on the clipboard — the owner asked for it in so
// many words (D105), unlike the recordings themselves, which are only listened
// to (D63).

export type TranscriptStatus = "queued" | "running" | "done" | "failed";
type Status = TranscriptStatus | "none";
type Notice = "waiting" | "busy" | "unavailable" | "failed" | null;

export const TRANSCRIPT_POLL_MS = 5000;

const url = (recordingId: string) =>
  `/api/skillklan/interview-recordings/${encodeURIComponent(recordingId)}/transcript`;

type View = { status: Status; segments?: TranscriptSegment[] };

async function readView(recordingId: string): Promise<View> {
  const res = await fetch(url(recordingId), { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as View;
}

export function useRecordingTranscript(recordingId: string, initial: TranscriptStatus | undefined, available: boolean) {
  const [status, setStatus] = useState<Status>(initial ?? "none");
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(initial === "queued" || initial === "running" ? "waiting" : null);
  // Opened by itself only for the person who pressed the button on this page.
  const pressed = useRef(false);

  const settle = useCallback((view: View) => {
    setStatus(view.status);
    if (view.status === "done") {
      setSegments(view.segments ?? []);
      setNotice(null);
      if (pressed.current) setOpen(true);
      pressed.current = false;
    } else if (view.status === "failed") {
      setNotice(pressed.current ? "failed" : null);
      pressed.current = false;
    } else if (view.status === "queued" || view.status === "running") {
      setNotice("waiting");
    }
  }, []);

  const waiting = status === "queued" || status === "running";
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const timer = setInterval(() => {
      readView(recordingId)
        .then((view) => alive && settle(view))
        .catch(() => {});
    }, TRANSCRIPT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [waiting, recordingId, settle]);

  const onClick = async () => {
    if (status === "done") {
      if (segments === null) {
        try {
          settle(await readView(recordingId));
        } catch {
          setNotice("failed");
          return;
        }
      }
      setOpen((o) => !o);
      return;
    }
    if (waiting) return;
    if (!available) {
      setNotice("unavailable");
      return;
    }
    pressed.current = true;
    setNotice(null);
    try {
      const res = await fetch(url(recordingId), { method: "POST", cache: "no-store" });
      if (res.status === 409 || res.status === 503) {
        pressed.current = false;
        setNotice(res.status === 409 ? "busy" : "unavailable");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { status: next } = (await res.json()) as { status: TranscriptStatus };
      if (next === "done") settle(await readView(recordingId));
      else settle({ status: next });
    } catch {
      pressed.current = false;
      setNotice("failed");
    }
  };

  return { status, segments, open, notice, onClick, close: () => setOpen(false) };
}

export function TranscriptButton({
  status,
  open,
  onClick,
}: {
  status: Status;
  open: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("interviews");
  const working = status === "queued" || status === "running";
  const label = working
    ? t("recordings.transcript.working")
    : status === "done"
      ? t("recordings.transcript.text")
      : t("recordings.transcript.transcribe");
  return (
    <Button
      type="button"
      size="sm"
      variant={open ? "secondary" : "outline"}
      onClick={onClick}
      disabled={working}
      aria-expanded={status === "done" ? open : undefined}
    >
      {working ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" aria-hidden="true" />
      ) : (
        <FileText className="h-3.5 w-3.5 sm:mr-1" aria-hidden="true" />
      )}
      {/* On a phone the icon alone; the name stays for screen readers. */}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  );
}

export function TranscriptNotice({ notice }: { notice: Notice }) {
  const t = useTranslations("interviews");
  if (!notice) return null;
  return (
    <p
      role={notice === "waiting" ? "status" : "alert"}
      className={notice === "waiting" ? "mt-1 text-xs text-muted-foreground" : "mt-1 text-xs text-amber-700 dark:text-amber-400"}
    >
      {t(`recordings.transcript.${notice}`)}
    </p>
  );
}

export function TranscriptPanel({
  segments,
  onClose,
}: {
  segments: TranscriptSegment[];
  onClose: () => void;
}) {
  const t = useTranslations("interviews");
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const speaker = (n: number) => t("recordings.transcript.speaker", { n });

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptAsText(segments, speaker));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <section
      aria-label={t("recordings.transcript.title")}
      className="mt-2 rounded-md border bg-muted/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{t("recordings.transcript.title")}</h4>
        <div className="flex gap-1">
          {segments.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={onCopy}>
              <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {copy === "copied"
                ? t("recordings.transcript.copied")
                : copy === "failed"
                  ? t("recordings.transcript.copyFailed")
                  : t("recordings.transcript.copy")}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label={t("recordings.transcript.collapse")}>
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {segments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("recordings.transcript.noSpeech")}</p>
      ) : (
        <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
          {segments.map((s, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground">
                {speaker(s.speaker)} · {clock(s.start)}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{s.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t("recordings.transcript.automatic")}</p>
    </section>
  );
}
