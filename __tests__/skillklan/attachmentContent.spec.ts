// @vitest-environment node
// Requirement — the owner, 2026-10-19 (D78–D80): attachments are viewed on the
// page, never downloaded; pictures and PDFs, and the other files too where the
// browser can show them. So the server sends a form to show, made from the
// file — not the file:
//   · a picture is re-encoded: what a phone wrote into it (GPS, the device) does
//     not reach the browser, and it is turned the way the camera meant;
//     a picture the converter cannot read is "cannot be shown", not broken;
//   · a PDF goes as a PDF (only if it is one); a Word document becomes a page —
//     its text and structure, no scripts, nothing loaded from elsewhere; a
//     decompression bomb is refused before unpacking;
//   · text as UTF-8 text, the beginning of a long one with "cut" said;
//   · anything else — cannot be shown.
// Real sharp, mammoth and jszip; only Drive is a fake.
import sharp from "sharp";
import JSZip from "jszip";
import type { Attachment } from "@/skillklan/recordingAttachments";

const drive = vi.hoisted(() => ({ bytes: Buffer.alloc(0) as Buffer, truncated: false, calls: [] as { limit: number; truncate?: boolean }[] }));
vi.mock("@/skillklan/interviewRecordings", () => ({
  fetchAttachmentBytes: vi.fn(async (_a: unknown, limit: number, options: { truncate?: boolean } = {}) => {
    drive.calls.push({ limit, truncate: options.truncate });
    return { bytes: drive.bytes, truncated: drive.truncated };
  }),
}));

import { ATTACHMENT_LIMITS, AttachmentUnviewableError, attachmentContent } from "@/skillklan/attachmentContent";

const attachment = (view: Attachment["view"], mimeType = "application/octet-stream"): Attachment => ({
  id: "att00000000001", name: "file", mimeType, size: null, kind: "qaTech", company: "Acme", folder: null, recordingId: null, view,
});

beforeEach(() => {
  drive.bytes = Buffer.alloc(0);
  drive.truncated = false;
  drive.calls = [];
});

async function docx(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer" });
}
const DOCX_FILES = {
  "[Content_Types].xml":
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  "_rels/.rels":
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  "word/document.xml":
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    "<w:p><w:r><w:t>Питання: тест-дизайн &lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p></w:body></w:document>",
};

describe("a picture", () => {
  it("re-encoded: no metadata (GPS, device) reaches the page, turned as the camera meant, smaller than the limit side", async () => {
    // A phone photo: 300×100 as stored, "rotate 90°" in its metadata, GPS and the device written in.
    drive.bytes = await sharp({ create: { width: 300, height: 100, channels: 3, background: "#3366cc" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneMaker", Model: "Phone 15" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "50/1 27/1 0/1" } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(drive.bytes).metadata()).exif).toBeDefined(); // the fixture does carry it

    const out = await attachmentContent(attachment("image", "image/jpeg"));
    expect(out.contentType).toBe("image/webp");
    const meta = await sharp(out.body).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([100, 300]); // turned
    expect(out.body.includes(Buffer.from("PhoneMaker"))).toBe(false);
    expect(drive.calls[0].limit).toBe(ATTACHMENT_LIMITS.image);
  });

  it("a large one comes down to 2400 px on the longer side", async () => {
    drive.bytes = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#fff" } }).png().toBuffer();
    const meta = await sharp((await attachmentContent(attachment("image", "image/png"))).body).metadata();
    expect([meta.width, meta.height]).toEqual([2400, 600]);
  });

  it("one the converter cannot read → cannot be shown (not a broken picture)", async () => {
    drive.bytes = Buffer.from("not a picture at all");
    await expect(attachmentContent(attachment("image", "image/heic"))).rejects.toBeInstanceOf(AttachmentUnviewableError);
  });
});

describe("a PDF", () => {
  it("goes as a PDF", async () => {
    drive.bytes = Buffer.from("%PDF-1.4 …");
    const out = await attachmentContent(attachment("pdf", "application/pdf"));
    expect(out).toEqual({ body: drive.bytes, contentType: "application/pdf", truncated: false });
    expect(drive.calls[0].limit).toBe(ATTACHMENT_LIMITS.pdf);
  });

  it("not a PDF inside → cannot be shown", async () => {
    drive.bytes = Buffer.from("<html>");
    await expect(attachmentContent(attachment("pdf", "application/pdf"))).rejects.toBeInstanceOf(AttachmentUnviewableError);
  });
});

describe("a Word document", () => {
  it("becomes a page: its text, escaped; no scripts and nothing from elsewhere by the page's own policy", async () => {
    drive.bytes = await docx(DOCX_FILES);
    const out = await attachmentContent(attachment("page"));
    expect(out.contentType).toBe("text/html; charset=utf-8");
    const html = out.body.toString("utf8");
    expect(html).toContain("Питання: тест-дизайн");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(`content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"`);
  });

  it("a decompression bomb (too many entries) → refused before unpacking", async () => {
    const files: Record<string, string> = { ...DOCX_FILES };
    for (let i = 0; i < 1001; i++) files[`word/media/x${i}.xml`] = "x";
    drive.bytes = await docx(files);
    await expect(attachmentContent(attachment("page"))).rejects.toBeInstanceOf(AttachmentUnviewableError);
  });

  it("not a document at all → cannot be shown", async () => {
    drive.bytes = Buffer.from("plain bytes");
    await expect(attachmentContent(attachment("page"))).rejects.toBeInstanceOf(AttachmentUnviewableError);
  });
});

describe("text", () => {
  it("as UTF-8 text; a long one — its beginning, and the page is told it is cut", async () => {
    drive.bytes = Buffer.from("// перевірка\nfunction check() {}\n");
    drive.truncated = true;
    const out = await attachmentContent(attachment("text", "text/javascript"));
    expect(out).toEqual({ body: drive.bytes, contentType: "text/plain; charset=utf-8", truncated: true });
    expect(drive.calls[0]).toEqual({ limit: ATTACHMENT_LIMITS.text, truncate: true });
  });
});

it("anything else → cannot be shown, and Drive is not even asked", async () => {
  await expect(attachmentContent(attachment("none", "application/zip"))).rejects.toBeInstanceOf(AttachmentUnviewableError);
  expect(drive.calls).toEqual([]);
});
