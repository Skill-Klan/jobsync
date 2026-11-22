import { APP_CONSTANTS } from "@/lib/constants";
import { preflightZip } from "@/lib/ai/import/extract-text";

// A Word document as a page that can be read, never run: its text, headings,
// lists, tables and pictures — no scripts, nothing loaded from elsewhere (the
// document's own policy says so, and callers show it in a sandboxed frame).
// Shared by the interview attachments viewer and the resume file preview.

export class DocxUnreadableError extends Error {
  constructor(reason: string) {
    super(`docx: cannot show (${reason})`);
    this.name = "DocxUnreadableError";
  }
}

// The policy the page carries itself, also sent as a header by routes that
// serve it: nothing but its own inline style and data: pictures.
export const DOCX_PAGE_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

export async function docxToPage(bytes: Buffer): Promise<string> {
  let zip;
  try {
    zip = preflightZip(bytes);
  } catch {
    throw new DocxUnreadableError("not a docx");
  }
  if (
    zip.entries > APP_CONSTANTS.RESUME_IMPORT_MAX_DOCX_ENTRIES ||
    zip.uncompressedBytes > APP_CONSTANTS.RESUME_IMPORT_MAX_DOCX_UNCOMPRESSED_BYTES
  ) {
    throw new DocxUnreadableError("docx too large unpacked");
  }
  const mammoth = await import("mammoth");
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: bytes })).value;
  } catch {
    throw new DocxUnreadableError("docx");
  }
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${DOCX_PAGE_POLICY}">
<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.6;margin:16px;color:#1f1f1f;background:#fff}
img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>
</head><body>${html}</body></html>`;
}
