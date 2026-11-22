// Tests for GET /api/profile/resume: the file is found through the caller's
// own resume row, never through a client-supplied path.
import path from "path";

const { existsSync, readFileSync } = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("fs", () => ({
  default: { existsSync, readFileSync },
  existsSync,
  readFileSync,
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  default: { resume: { findUnique: vi.fn() } },
}));

vi.mock("next/server", () => ({
  NextResponse: class {
    status = 200;
    body: unknown;
    headers: Record<string, string>;
    constructor(body: unknown, init?: { headers?: Record<string, string> }) {
      this.body = body;
      this.headers = init?.headers ?? {};
    }
    static json(data: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => data };
    }
  },
}));

import { GET } from "@/app/api/profile/resume/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import JSZip from "jszip";

const db = prisma as any;

async function makeDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escaped}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
const resumesDir = path.join(APP_CONSTANTS.UPLOADS_DIR, "files", "resumes");
const req = (query: string) =>
  ({ url: `http://localhost/api/profile/resume?${query}` }) as any;
const withFile = (filePath: string) =>
  db.resume.findUnique.mockResolvedValue({ File: { filePath } });

describe("GET /api/profile/resume", () => {
  beforeEach(() => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(Buffer.from("%PDF"));
  });

  it("streams the file attached to the caller's own resume", async () => {
    withFile(path.join(resumesDir, "cv.pdf"));

    const res: any = await GET(req("resumeId=r1"));

    expect(db.resume.findUnique).toHaveBeenCalledWith({
      where: { id: "r1", profile: { userId: "user-1" } },
      select: { File: { select: { filePath: true } } },
    });
    expect(res.status).toBe(200);
    expect(res.headers["Content-Disposition"]).toBe(
      'attachment; filename="cv.pdf"',
    );
  });

  it("returns 404 for a resume the caller does not own", async () => {
    db.resume.findUnique.mockResolvedValue(null);

    const res: any = await GET(req("resumeId=someone-elses"));

    expect(res.status).toBe(404);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("ignores a filePath query param", async () => {
    const res: any = await GET(req("filePath=%2Fdata%2Fsecret.pdf"));

    expect(res.status).toBe(400);
    expect(db.resume.findUnique).not.toHaveBeenCalled();
    expect(existsSync).not.toHaveBeenCalled();
  });

  it.each([
    path.join(APP_CONSTANTS.UPLOADS_DIR, "backups", "cv.pdf"),
    path.join(`${resumesDir}-old`, "cv.pdf"),
    "/etc/cv.pdf",
  ])("refuses a stored path outside the resumes directory: %s", async (filePath) => {
    withFile(filePath);

    const res: any = await GET(req("resumeId=r1"));

    expect(res.status).toBe(404);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  // Requirement — SKD-56: a student opens the file attached to a resume and
  // reads it in the page, without downloading: a PDF as it is, a Word document
  // as a page that cannot run anything (owner's ticket "PDF і DOCX відкриваються
  // для перегляду без завантаження").
  describe("?view=1 — to read, not to save", () => {
    it("a PDF goes inline (not as an attachment to save) and as it is", async () => {
      withFile(path.join(resumesDir, "cv.pdf"));

      const res: any = await GET(req("resumeId=r1&view=1"));

      expect(res.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/pdf");
      expect(res.headers["Content-Disposition"]).toBe("inline");
      expect(res.body).toEqual(Buffer.from("%PDF"));
    });

    it("a Word document becomes an inert page: its text escaped, a sandbox policy on the response", async () => {
      withFile(path.join(resumesDir, "cv.docx"));
      readFileSync.mockReturnValue(await makeDocx("Senior QA <script>alert(1)</script>"));

      const res: any = await GET(req("resumeId=r1&view=1"));

      expect(res.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
      expect(res.headers["Content-Security-Policy"]).toMatch(/^sandbox; default-src 'none'/);
      expect(res.body).toContain("Senior QA");
      expect(res.body).toContain("&lt;script&gt;");
      expect(res.body).not.toContain("<script>");
    });

    it("a Word file that is not a document → 415, not a broken page", async () => {
      withFile(path.join(resumesDir, "cv.docx"));
      readFileSync.mockReturnValue(Buffer.from("plain bytes"));

      const res: any = await GET(req("resumeId=r1&view=1"));

      expect(res.status).toBe(415);
    });

    it("someone else's resume is still not found", async () => {
      db.resume.findUnique.mockResolvedValue(null);

      const res: any = await GET(req("resumeId=someone-elses&view=1"));

      expect(res.status).toBe(404);
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it("without view=1 the file still comes as a download (paired case)", async () => {
      withFile(path.join(resumesDir, "cv.docx"));

      const res: any = await GET(req("resumeId=r1"));

      expect(res.headers["Content-Disposition"]).toBe('attachment; filename="cv.docx"');
    });
  });
});
