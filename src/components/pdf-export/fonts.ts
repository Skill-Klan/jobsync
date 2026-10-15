import type { FontQuartet } from "./tokens";

// The standard-14 PDF fonts carry no Cyrillic: a Ukrainian name came out as
// "•0==060:528G". Every family is shipped instead, one static file per style,
// served from public/fonts with its license (all OFL-1.1):
//   sans  — Inter (rsms/inter v4.1);
//   serif — Tinos, Times New Roman's metric twin (google/fonts ofl/tinos);
//   mono  — Cousine, Courier New's metric twin (google/fonts ofl/cousine).
const quartet = (family: string): FontQuartet => ({
  regular: family,
  bold: `${family}-Bold`,
  italic: `${family}-Italic`,
  boldItalic: `${family}-BoldItalic`,
});

export const INTER = quartet("Inter");
export const TINOS = quartet("Tinos");
export const COUSINE = quartet("Cousine");

const FILES: Record<string, string> = Object.fromEntries(
  [INTER, TINOS, COUSINE].flatMap((q) => [
    [q.regular, `${q.regular}-Regular.ttf`],
    [q.bold, `${q.bold}.ttf`],
    [q.italic, `${q.italic}.ttf`],
    [q.boldItalic, `${q.boldItalic}.ttf`],
  ]),
);

type FontRegistry = {
  register: (font: { family: string; src: string }) => void;
};

// react-pdf adds a source on every register() instead of replacing it, so
// each base (a URL in the browser, a folder in tests) is registered once.
const registered = new Set<string>();

export function defaultFontBase(): string {
  return `${window.location.origin}/fonts`;
}

export function registerPdfFonts(Font: FontRegistry, base: string): void {
  if (registered.has(base)) return;
  for (const [family, file] of Object.entries(FILES)) {
    Font.register({ family, src: `${base}/${file}` });
  }
  registered.add(base);
}
