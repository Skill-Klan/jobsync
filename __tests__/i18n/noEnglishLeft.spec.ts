// @vitest-environment node
// Requirement — D29: nothing a person reads in the interface is hard-coded in
// English. Every JSX text and every visible attribute (placeholder, title,
// aria-label, alt, label…) comes from the dictionaries. The exceptions are
// listed below, each with its reason; a new one has to be argued for here.
import fs from "fs";
import path from "path";
import ts from "typescript";

const VISIBLE_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "description", "tooltip"]);

// Pickers take an English noun for the English prompt only ("Select stage");
// Ukrainian drops it (see UK_DROPS_ARGS in messages.spec.ts).
const NOUN_FOR_ENGLISH_PROMPT = new Set(["SelectFormCtrl", "Combobox", "ComboBox", "RecordsCount"]);

// Not interface text: brands, initials, sample addresses.
const NOT_TEXT = new Set(["SkillKlan Job", "LinkedIn", "JS"]);
const looksLikeAddress = (s: string) => /:\/\/|@|^https?/.test(s);

const EXCLUDED = [
  // Shown only in local development (isDevPasswordLoginEnabled / NODE_ENV).
  "src/components/developer/",
  "src/app/dashboard/developer/",
  "src/components/auth/AuthCard.tsx",
  "src/components/auth/SigninForm.tsx",
  "src/components/auth/SignupForm.tsx",
  // The resume PDF is the student's document in the language they write it in.
  "src/components/profile/resume-pdf/",
];

// Known and decided: the AM/PM column of the time picker. It is rendered in
// English only — Ukrainian uses the 24-hour clock without it (D36).
const KNOWN = new Set(["src/components/TimePicker.tsx\tlabel\tAM/PM"]);

const LATIN_WORD = /[A-Za-z]{2,}/;

type Hit = string; // file \t where \t text

function englishIn(file: string, source: string): Hit[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText().replace(/\s+/g, " ").trim();
      if (text && LATIN_WORD.test(text) && !NOT_TEXT.has(text)) hits.push(`${file}\ttext\t${text}`);
    } else if (
      ts.isJsxAttribute(node) &&
      VISIBLE_ATTRS.has(node.name.getText()) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const name = node.name.getText();
      const text = node.initializer.text;
      const element = (node.parent.parent as ts.JsxOpeningLikeElement).tagName.getText();
      const allowed =
        NOT_TEXT.has(text) ||
        looksLikeAddress(text) ||
        (name === "label" && NOUN_FOR_ENGLISH_PROMPT.has(element));
      if (LATIN_WORD.test(text) && !allowed) hits.push(`${file}\t${name}\t${text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? tsxFiles(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("the detector", () => {
  it("finds English text and visible attributes", () => {
    expect(englishIn("x.tsx", "<p>Upload files</p>")).toHaveLength(1);
    expect(englishIn("x.tsx", '<Input placeholder="Search jobs" />')).toHaveLength(1);
    expect(englishIn("x.tsx", '<button aria-label="Close" />')).toHaveLength(1);
  });

  it("lets through translated text and the decided exceptions", () => {
    expect(englishIn("x.tsx", '<p>{t("upload")}</p>')).toEqual([]);
    expect(englishIn("x.tsx", "<p>Завантажити файли</p>")).toEqual([]);
    expect(englishIn("x.tsx", '<SelectFormCtrl label="Job Status" />')).toEqual([]);
    expect(englishIn("x.tsx", '<Input placeholder="https://example.com" />')).toEqual([]);
    expect(englishIn("x.tsx", "<span>SkillKlan Job</span>")).toEqual([]);
  });
});

describe("the interface", () => {
  it("has no hard-coded English left", () => {
    const root = process.cwd();
    const files = tsxFiles(path.join(root, "src"))
      .map((f) => path.relative(root, f).split(path.sep).join("/"))
      .filter((f) => !EXCLUDED.some((e) => f.startsWith(e)));
    // The walk really reached the components (a wrong root would pass empty).
    expect(files).toContain("src/components/AddStageDialog.tsx");

    const hits = files
      .flatMap((f) => englishIn(f, fs.readFileSync(path.join(root, f), "utf8")))
      .filter((h) => !KNOWN.has(h));
    expect(hits).toEqual([]);
  });
});
