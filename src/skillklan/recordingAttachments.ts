import type { RecordingKind } from "./recordingKinds";

// Files lying next to the interview recordings on Drive — a picture of a task,
// a PDF, notes (owner 2026-10-19). Everyone who hears the recordings sees them
// too (D79); they are viewed on the page, never downloaded (D80, like D63).
//
// Drive does not tie a file to another file, only to its folder. So (D77) an
// attachment goes beside a recording only when that is certain — the folder
// holds one recording, or the attachment's name starts with exactly one
// recording's name — and on its folder otherwise.
//
// Pure: shared by the server (placing) and the page (showing).

// How the page shows a file (D78: pictures and PDFs, and the other files too
// where the browser can show them after the server converts them):
//   image — the server re-encodes it (no metadata, e.g. a phone's GPS);
//   pdf   — a PDF, or a Google document / sheet / slides / drawing exported to PDF;
//   page  — a Word document turned into a page;
//   text  — text and code, as text;
//   none  — nothing the browser can show (a spreadsheet, an archive…).
export type AttachmentView = "image" | "pdf" | "page" | "text" | "none";

export type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  kind: RecordingKind;
  company: string | null;
  // As a recording's: the folders below the company's (" / " between levels).
  folder: string | null;
  // The recording it belongs to, when that is certain (D77); null — its folder.
  recordingId: string | null;
  view: AttachmentView;
};

// The page asks for an attachment with this header (value "1"); the server
// refuses a request without it — an attachment's address opened in a tab, or
// saved, gets nothing.
export const VIEWER_HEADER = "x-skillklan-viewer";

export const GOOGLE_EXPORTED_TO_PDF: ReadonlySet<string> = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
]);
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEXT_MIMES: ReadonlySet<string> = new Set([
  "application/json",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/x-sh",
  "application/sql",
]);
// Drive often stores code and notes as application/octet-stream — then the
// name tells.
const TEXT_NAME = /\.(txt|md|csv|tsv|json|js|mjs|cjs|jsx|ts|tsx|py|java|kt|cs|go|rb|php|sql|xml|ya?ml|log|ini|sh|feature|html?|css)$/i;

export function attachmentView(mimeType: string, name: string): AttachmentView {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || GOOGLE_EXPORTED_TO_PDF.has(mimeType)) return "pdf";
  if (mimeType === DOCX_MIME) return "page";
  if (mimeType.startsWith("text/") || TEXT_MIMES.has(mimeType) || TEXT_NAME.test(name)) return "text";
  return "none";
}

// "Acme_tech_12.03.26.m4a" → "acme_tech_12.03.26": the name without its type,
// any case. Google's own documents have no extension — and a name ending in a
// date ("…_12.03.26") keeps it: a type has a letter in it.
function stem(name: string): string {
  return name
    .trim()
    .replace(/\.(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{1,5}$/, "")
    .trim()
    .toLowerCase();
}

// Shorter is not a name, it is a coincidence ("1.m4a" and "1 task.png").
const MIN_STEM = 3;
const AFTER_STEM = /[\s_\-.(\[]/;

// Which of the recordings lying in the same folder this attachment belongs
// to — or null when that is not certain (it then goes on the folder).
export function recordingOf(
  attachmentName: string,
  siblings: readonly { id: string; name: string }[],
): string | null {
  if (siblings.length === 1) return siblings[0].id;
  const own = stem(attachmentName);
  const named = siblings
    .map((s) => ({ id: s.id, stem: stem(s.name) }))
    .filter(
      (s) =>
        s.stem.length >= MIN_STEM &&
        (own === s.stem || (own.startsWith(s.stem) && AFTER_STEM.test(own[s.stem.length]))),
    );
  if (named.length === 0) return null;
  // "acme_tech" and "acme_tech_2" both start "acme_tech_2_task" — the longer wins.
  const longest = Math.max(...named.map((s) => s.stem.length));
  const best = named.filter((s) => s.stem.length === longest);
  return best.length === 1 ? best[0].id : null;
}
