import type { BaseExportSettings, PdfFont } from "@/models/pdfExport.model";
import { INTER } from "./fonts";

export type FontQuartet = {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
};

// The sans option is Inter, shipped in public/fonts (see ./fonts): the
// standard-14 Helvetica has no Cyrillic. Its stored key stays "helvetica" —
// people's saved settings hold it. Times and Courier are still the
// standard-14 families and still have no Cyrillic.
export const FONT_QUARTETS: Record<PdfFont, FontQuartet> = {
  helvetica: INTER,
  times: {
    regular: "Times-Roman",
    bold: "Times-Bold",
    italic: "Times-Italic",
    boldItalic: "Times-BoldItalic",
  },
  courier: {
    regular: "Courier",
    bold: "Courier-Bold",
    italic: "Courier-Oblique",
    boldItalic: "Courier-BoldOblique",
  },
};

// Every derived size in every sheet is proportional to this.
export const BASE_FONT_SIZE = 11;

export type BaseStyleTokens = {
  font: FontQuartet;
  /** The base size itself. Assigned, never passed through `pt`. */
  fontSize: number;
  /** Sizes derived from the base, and font-metric widths. */
  pt: (literal: number) => number;
  lineHeight: number;
  marginVertical: number;
  marginHorizontal: number;
};

export function styleTokens(settings: BaseExportSettings): BaseStyleTokens {
  const scale = settings.fontSize / BASE_FONT_SIZE;

  return {
    font: FONT_QUARTETS[settings.font],
    fontSize: settings.fontSize,
    // A scale of exactly 1 returns the literal untouched rather than
    // rounding it, so the defaults reproduce each shipped sheet exactly.
    pt: (literal) =>
      scale === 1 ? literal : Math.round(literal * scale * 10) / 10,
    lineHeight: settings.lineHeight,
    marginVertical: settings.marginVertical,
    marginHorizontal: settings.marginHorizontal,
  };
}
