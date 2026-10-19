"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, File, FileCode, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Loading from "../Loading";
import { useTranslations } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { VIEWER_HEADER, type Attachment, type AttachmentView } from "@/skillklan/recordingAttachments";
import { openPdf, type PdfDocument } from "./pdfDocument";

// The files lying next to the interview recordings (owner 2026-10-19,
// D77–D80): a button beside a recording or on a folder, a menu of the files,
// a viewer — and no way to download. A picture and a PDF page are drawn on a
// canvas (no "Save image as"), a Word document sits in a sandboxed frame, text
// is text; there is no download button anywhere, the address of a file opens
// nothing outside this page (VIEWER_HEADER). A screenshot is still possible —
// as with the recordings, every ordinary way is closed, not every way.

const API = "/api/skillklan/interview-recordings/attachments";

const ICONS: Record<AttachmentView, typeof File> = {
  image: ImageIcon,
  pdf: FileText,
  page: FileText,
  text: FileCode,
  none: File,
};

export function AttachmentsButton({
  attachments,
  place,
}: {
  attachments: Attachment[];
  place: "recording" | "folder";
}) {
  const t = useTranslations("interviews");
  const [open, setOpen] = useState(false);
  const viewable = attachments.filter((a) => a.view !== "none");
  const [viewing, setViewing] = useState<number | null>(null);
  if (attachments.length === 0) return null;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={t("recordings.attachments.aria", { count: attachments.length })}
          >
            <Paperclip className="h-3.5 w-3.5 sm:mr-1" aria-hidden />
            {/* A phone: the clip and the number only. */}
            <span className="sr-only sm:not-sr-only sm:mr-1">
              {place === "folder" ? t("recordings.attachments.folder") : t("recordings.attachments.button")}
            </span>
            <span className="tabular-nums">{attachments.length}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] p-1">
          {place === "folder" && (
            <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">{t("recordings.attachments.folderNote")}</p>
          )}
          <ul>
            {attachments.map((a) => {
              const Icon = ICONS[a.view];
              const index = viewable.indexOf(a);
              const content = (
                <>
                  <Icon className={cn("h-4 w-4 shrink-0", index >= 0 ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {index >= 0 ? t("recordings.attachments.view") : t("recordings.attachments.unavailable")}
                  </span>
                </>
              );
              return (
                <li key={a.id}>
                  {index >= 0 ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setOpen(false);
                        setViewing(index);
                      }}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {viewing !== null && (
        <AttachmentViewer items={viewable} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

function AttachmentViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Attachment[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("interviews");
  const item = items[index];
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl gap-3 p-4 sm:p-5" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex min-w-0 items-center gap-2 pr-8">
          <DialogTitle className="min-w-0 flex-1 truncate text-base">{item.name}</DialogTitle>
          {items.length > 1 && (
            <>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("recordings.attachments.counter", { index: index + 1, total: items.length })}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                aria-label={t("recordings.attachments.previous")}
                onClick={() => onIndex((index - 1 + items.length) % items.length)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                aria-label={t("recordings.attachments.next")}
                onClick={() => onIndex((index + 1) % items.length)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
        <DialogDescription className="sr-only">{t("recordings.attachments.viewOnly")}</DialogDescription>
        <AttachmentBody key={item.id} attachment={item} />
      </DialogContent>
    </Dialog>
  );
}

type Loaded =
  | { state: "loading" }
  | { state: "failed"; reason: "cannotShow" | "tooLarge" | "failed" }
  | { state: "image"; blob: Blob }
  | { state: "pdf"; data: ArrayBuffer }
  | { state: "page"; html: string }
  | { state: "text"; text: string; truncated: boolean };

function AttachmentBody({ attachment }: { attachment: Attachment }) {
  const t = useTranslations("interviews");
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/${encodeURIComponent(attachment.id)}`, {
      headers: { [VIEWER_HEADER]: "1" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const reason = res.status === 415 ? "cannotShow" : res.status === 413 ? "tooLarge" : "failed";
          setLoaded({ state: "failed", reason });
          return;
        }
        if (attachment.view === "image") setLoaded({ state: "image", blob: await res.blob() });
        else if (attachment.view === "pdf") setLoaded({ state: "pdf", data: await res.arrayBuffer() });
        else if (attachment.view === "page") setLoaded({ state: "page", html: await res.text() });
        else {
          setLoaded({
            state: "text",
            text: await res.text(),
            truncated: res.headers.get("x-skillklan-truncated") === "1",
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ state: "failed", reason: "failed" });
      });
    return () => controller.abort();
  }, [attachment.id, attachment.view]);

  if (loaded.state === "loading") return <Loading />;
  if (loaded.state === "failed") {
    return (
      <p role="alert" className="py-10 text-center text-sm text-muted-foreground">
        {t(`recordings.attachments.${loaded.reason}`)}
      </p>
    );
  }
  if (loaded.state === "image") return <ImageCanvas blob={loaded.blob} label={attachment.name} />;
  if (loaded.state === "pdf") return <PdfPages data={loaded.data} label={attachment.name} />;
  if (loaded.state === "page") {
    return (
      // No scripts, no forms, no popups, no navigating this page: the sandbox
      // allows nothing but being read as this site's document (without
      // scripts that grants the frame nothing; an opaque origin rendered blank
      // in the in-app browser's screenshots, so this way it is checkable).
      <iframe
        sandbox="allow-same-origin"
        srcDoc={loaded.html}
        title={attachment.name}
        className="h-[70vh] w-full rounded-md border bg-white"
      />
    );
  }
  return (
    <div className="space-y-2">
      {loaded.truncated && <p className="text-xs text-muted-foreground">{t("recordings.attachments.truncated")}</p>}
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {loaded.text}
      </pre>
    </div>
  );
}

// Drawn, not an <img>: the browser offers no "Save image as" for a canvas.
function ImageCanvas({ blob, label }: { blob: Blob; label: string }) {
  const t = useTranslations("interviews");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let bitmap: ImageBitmap | null = null;
    let alive = true;
    createImageBitmap(blob)
      .then((b) => {
        bitmap = b;
        const el = canvas.current;
        if (!alive || !el) return;
        el.width = b.width;
        el.height = b.height;
        el.getContext("2d")?.drawImage(b, 0, 0);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      bitmap?.close();
    };
  }, [blob]);
  if (failed) {
    return (
      <p role="alert" className="py-10 text-center text-sm text-muted-foreground">
        {t("recordings.attachments.cannotShow")}
      </p>
    );
  }
  return (
    <div className="flex max-h-[70vh] justify-center overflow-auto">
      <canvas ref={canvas} role="img" aria-label={label} className="h-auto max-w-full" draggable={false} />
    </div>
  );
}

// A PDF's pages, one at a time, drawn by pdf.js (unpdf's build, loaded on the
// first PDF) — not the browser's own viewer, which has a download button.
function PdfPages({ data, label }: { data: ArrayBuffer; label: string }) {
  const t = useTranslations("interviews");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // A copy: pdf.js takes the buffer it is given (it is detached after), and
    // this effect may run again on the same data.
    openPdf(new Uint8Array(data.slice(0)))
      .then((opened) => alive && setDoc(opened))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [data]);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    let task: { cancel: () => void } | null = null;
    doc
      .getPage(pageNumber)
      .then((page) => {
        const el = canvas.current;
        if (!alive || !el) return;
        // Sharp on a high-density screen; as wide as the dialog lets it be.
        const width = el.parentElement?.clientWidth || 720;
        const base = page.getViewport({ scale: 1 });
        const scale = (width / base.width) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        const context = el.getContext("2d");
        if (!context) return;
        const rendering = page.render({ canvasContext: context, viewport });
        task = rendering;
        return rendering.promise;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, pageNumber]);

  if (failed) {
    return (
      <p role="alert" className="py-10 text-center text-sm text-muted-foreground">
        {t("recordings.attachments.cannotShow")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="max-h-[65vh] overflow-auto rounded-md border bg-muted/40">
        {!doc && <Loading />}
        <canvas ref={canvas} role="img" aria-label={label} className="h-auto w-full" />
      </div>
      {doc && doc.numPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label={t("recordings.attachments.previousPage")}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("recordings.attachments.page", { page: pageNumber, pages: doc.numPages })}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label={t("recordings.attachments.nextPage")}
            disabled={pageNumber >= doc.numPages}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
