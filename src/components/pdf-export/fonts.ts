import type { FontQuartet } from "./tokens";

// The standard-14 PDF fonts carry no Cyrillic: a Ukrainian name came out as
// "•0==060:528G". The sans family is Inter (OFL-1.1, rsms/inter v4.1), one
// static file per style, served from public/fonts.
export const INTER: FontQuartet = {
  regular: "Inter",
  bold: "Inter-Bold",
  italic: "Inter-Italic",
  boldItalic: "Inter-BoldItalic",
};

const FILES: Record<string, string> = {
  [INTER.regular]: "Inter-Regular.ttf",
  [INTER.bold]: "Inter-Bold.ttf",
  [INTER.italic]: "Inter-Italic.ttf",
  [INTER.boldItalic]: "Inter-BoldItalic.ttf",
};

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
