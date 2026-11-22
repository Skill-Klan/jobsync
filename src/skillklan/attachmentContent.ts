import "server-only";
import { PDF_MAGIC } from "@/lib/ai/import/extract-text";
import { DocxUnreadableError, docxToPage } from "@/lib/docxPage";
import { fetchAttachmentBytes } from "./interviewRecordings";
import type { Attachment } from "./recordingAttachments";

// What the page gets to show an attachment (owner 2026-10-19, D78–D80): a form
// the browser shows by itself, made here from the file on Drive — never the
// file to save. The page draws pictures and PDF pages on a canvas, puts a
// Word document into a sandboxed frame and text into the page.

// Limits on the file read from Drive, by what is done with it.
export const ATTACHMENT_LIMITS = {
  image: 25 * 1024 * 1024,
  pdf: 30 * 1024 * 1024,
  page: 15 * 1024 * 1024,
  text: 1024 * 1024, // longer — the beginning, said so on the page
} as const;
// The longest side of a picture as sent: enough to read a screenshot.
const IMAGE_MAX_SIDE = 2400;
// A decompression bomb is refused before it is decoded.
const IMAGE_MAX_PIXELS = 60_000_000;

export class AttachmentUnviewableError extends Error {
  constructor(reason: string) {
    super(`attachment: cannot show (${reason})`);
    this.name = "AttachmentUnviewableError";
  }
}

export type AttachmentContent = {
  body: Buffer;
  contentType: string;
  truncated: boolean;
};

export async function attachmentContent(attachment: Attachment, signal?: AbortSignal): Promise<AttachmentContent> {
  switch (attachment.view) {
    case "image":
      return image(attachment, signal);
    case "pdf":
      return pdf(attachment, signal);
    case "page":
      return page(attachment, signal);
    case "text":
      return text(attachment, signal);
    default:
      throw new AttachmentUnviewableError(attachment.mimeType);
  }
}

// Re-encoded, not passed through: what a phone wrote into the file (where it
// was taken, the device) does not reach the page; the picture is turned the
// way the camera meant. A format the converter cannot read (HEIC from an
// iPhone, mostly) is said to be unviewable rather than shown broken.
async function image(attachment: Attachment, signal?: AbortSignal): Promise<AttachmentContent> {
  const { bytes } = await fetchAttachmentBytes(attachment, ATTACHMENT_LIMITS.image, { signal });
  const { default: sharp } = await import("sharp");
  try {
    const body = await sharp(bytes, { limitInputPixels: IMAGE_MAX_PIXELS, animated: false })
      .rotate()
      .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { body, contentType: "image/webp", truncated: false };
  } catch (error) {
    throw new AttachmentUnviewableError(error instanceof Error ? error.message : "image");
  }
}

async function pdf(attachment: Attachment, signal?: AbortSignal): Promise<AttachmentContent> {
  const { bytes } = await fetchAttachmentBytes(attachment, ATTACHMENT_LIMITS.pdf, { signal });
  if (!bytes.subarray(0, 4).equals(PDF_MAGIC)) throw new AttachmentUnviewableError("not a pdf");
  return { body: bytes, contentType: "application/pdf", truncated: false };
}

// The page a Word document becomes (see docxToPage): shown in a sandboxed frame.
async function page(attachment: Attachment, signal?: AbortSignal): Promise<AttachmentContent> {
  const { bytes } = await fetchAttachmentBytes(attachment, ATTACHMENT_LIMITS.page, { signal });
  try {
    return { body: Buffer.from(await docxToPage(bytes), "utf8"), contentType: "text/html; charset=utf-8", truncated: false };
  } catch (error) {
    if (error instanceof DocxUnreadableError) throw new AttachmentUnviewableError(error.message);
    throw error;
  }
}

async function text(attachment: Attachment, signal?: AbortSignal): Promise<AttachmentContent> {
  const { bytes, truncated } = await fetchAttachmentBytes(attachment, ATTACHMENT_LIMITS.text, {
    signal,
    truncate: true,
  });
  // UTF-8; a broken last character of a cut file becomes "�", not an error.
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return { body: Buffer.from(decoded, "utf8"), contentType: "text/plain; charset=utf-8", truncated };
}
