// @vitest-environment node
// Requirement — D33: Ukrainian is drawn in one font. The interface font has
// every Ukrainian letter, and a resume or cover letter written in Ukrainian
// comes out of the PDF export readable — in regular, bold and italic. Text is
// read back from the real PDF the real renderer produced, not from our styles.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { extractText, getDocumentProxy } from "unpdf";
import { generateResumePdfBlob } from "@/components/profile/resume-pdf/generateResumePdf";
import { generateCoverLetterPdfBlob } from "@/components/profile/cover-letter-pdf/generateCoverLetterPdf";
import { defaultResumeExportSettings } from "@/models/resumeExport.model";
import { defaultCoverLetterExportSettings } from "@/models/coverLetterExport.model";
import { SectionType } from "@/models/profile.model";
import { registerPdfFonts } from "@/components/pdf-export/fonts";

// Neither ships types; both are already installed (jsdom for tests, fontkit
// under @react-pdf — the same library that reads the font when the PDF is drawn).
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const fontkit = require("fontkit");
const FONTS = path.join(process.cwd(), "public/fonts");
const UKRAINIAN = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюяʼ«»—";

// html-to-pdf parses descriptions with DOMParser, which node lacks.
beforeAll(() => {
  (globalThis as any).DOMParser = new JSDOM().window.DOMParser;
});

// The embedded font names (subset prefix "ABCDEF+" stripped): which faces
// really drew the text — extracted text can't tell bold from regular.
async function embeddedFonts(blob: Blob): Promise<string[]> {
  const raw = Buffer.from(await blob.arrayBuffer()).toString("latin1");
  return [...new Set([...raw.matchAll(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map((m) => m[1]))].sort();
}

async function pdfText(blob: Blob): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.replace(/\s+/g, " ");
}

describe("the interface font", () => {
  it("has every Ukrainian letter", () => {
    const font = fontkit.openSync(path.join(process.cwd(), "src/app/fonts/Inter-Variable.woff2"));
    const missing = [...UKRAINIAN].filter((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)));
    expect(missing).toEqual([]);
  });
});

describe("registering the PDF fonts", () => {
  // react-pdf adds a source on every register(); each export must not pile
  // up another four copies of the same files.
  it("happens once per font location, however many exports run", () => {
    const Font = { register: vi.fn() };
    registerPdfFonts(Font, "https://jobs.example/fonts");
    registerPdfFonts(Font, "https://jobs.example/fonts");
    expect(Font.register).toHaveBeenCalledTimes(4);
    expect(Font.register).toHaveBeenCalledWith({ family: "Inter-Bold", src: "https://jobs.example/fonts/Inter-Bold.ttf" });
    registerPdfFonts(Font, "/elsewhere");
    expect(Font.register).toHaveBeenCalledTimes(8);
  });
});

describe("PDF export in Ukrainian", () => {
  const resume: any = {
    id: "r1",
    title: "Резюме",
    ContactInfo: { firstName: "Ґанна", lastName: "Їжакевич", headline: "Тестувальниця ПЗ" },
    ResumeSections: [
      {
        sectionType: SectionType.SUMMARY,
        sectionTitle: "Про себе",
        summary: { content: "<p>Звичайний текст, <strong>жирний</strong>, <em>курсив</em>, <strong><em>обидва</em></strong>.</p>" },
      },
    ],
  };

  for (const template of ["simple", "professional"] as const) {
    it(`resume, ${template} template`, async () => {
      const { blob } = await generateResumePdfBlob(
        resume,
        { ...defaultResumeExportSettings, template },
        FONTS,
      );
      // The professional template sets the headline in capitals.
      const text = (await pdfText(blob)).toLowerCase();
      for (const phrase of ["Ґанна", "Їжакевич", "Тестувальниця ПЗ", "Звичайний текст", "жирний", "курсив", "обидва"]) {
        expect(text).toContain(phrase.toLowerCase());
      }
      expect(await embeddedFonts(blob)).toEqual(["Inter-Bold", "Inter-BoldItalic", "Inter-Italic", "Inter-Regular"]);
    });
  }

  it("cover letter", async () => {
    const { blob } = await generateCoverLetterPdfBlob(
      { title: "Лист", content: "<p>Шановна командо, <strong>щиро</strong> дякую.</p>" },
      { firstName: "Ґанна", lastName: "Їжакевич" } as any,
      defaultCoverLetterExportSettings,
      FONTS,
    );
    const text = await pdfText(blob);
    expect(text).toContain("Їжакевич");
    expect(text).toContain("Шановна командо");
    expect(text).toContain("щиро");
  });

  it("the font files are the ones the app serves", () => {
    for (const f of ["Inter-Regular.ttf", "Inter-Bold.ttf", "Inter-Italic.ttf", "Inter-BoldItalic.ttf", "LICENSE-Inter.txt"]) {
      expect(fs.existsSync(path.join(FONTS, f))).toBe(true);
    }
  });
});
