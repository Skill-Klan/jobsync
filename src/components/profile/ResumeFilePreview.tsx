"use client";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import Loading from "../Loading";
import { PdfPreviewPane } from "../pdf-export/PdfPreviewPane";
import { useTranslations } from "@/i18n/client";

// The file attached to a resume, read in the page without downloading it: a PDF
// drawn by pdf.js, a Word document as a page without scripts in a sandboxed
// frame (the server makes it, GET /api/profile/resume?view=1).

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "pdf"; blob: Blob }
  | { state: "page"; html: string };

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

export function ResumeFilePreviewButton({
  resumeId,
  fileName,
  title,
}: {
  resumeId: string;
  fileName: string;
  title: string;
}) {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        title={t("resumePage.preview")}
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">{t("resumePage.preview")}</span>
      </Button>
      {open && (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-3 p-4 sm:p-5">
            <DialogTitle className="truncate pr-8 text-base">{title}</DialogTitle>
            <DialogDescription className="sr-only">{t("resumePage.previewDescription")}</DialogDescription>
            <PreviewBody resumeId={resumeId} fileName={fileName} title={title} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function PreviewBody({ resumeId, fileName, title }: { resumeId: string; fileName: string; title: string }) {
  const t = useTranslations("profile");
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/profile/resume?resumeId=${encodeURIComponent(resumeId)}&view=1`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return setLoaded({ state: "failed" });
        if (isPdf(fileName)) setLoaded({ state: "pdf", blob: await res.blob() });
        else setLoaded({ state: "page", html: await res.text() });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ state: "failed" });
      });
    return () => controller.abort();
  }, [resumeId, fileName]);

  if (loaded.state === "loading") return <Loading />;
  if (loaded.state === "failed") {
    return (
      <p role="alert" className="py-10 text-center text-sm text-muted-foreground">
        {t("resumePage.previewFailed")}
      </p>
    );
  }
  if (loaded.state === "pdf") {
    return (
      <PdfPreviewPane
        blob={loaded.blob}
        isGenerating={false}
        hasError={false}
        canExport
        previewLabel={title}
        emptyMessage=""
        className="h-[70vh]"
      />
    );
  }
  return (
    // No scripts, no forms, no popups: the frame only reads the page.
    <iframe sandbox="allow-same-origin" srcDoc={loaded.html} title={title} className="h-[70vh] w-full rounded-md border bg-white" />
  );
}
