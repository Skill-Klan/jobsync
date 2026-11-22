import JSZip from "jszip";

// A minimal .xlsx for tests: tabs of rows of cells (strings; empty = no cell).
// Strings go to the shared strings part, except for tabs listed in `inline`,
// which use inline strings — both ways exist in real files.
export async function makeWorkbook(
  tabs: { name: string; rows: string[][] }[],
  inline: string[] = [],
): Promise<Uint8Array> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const shared: string[] = [];
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheets = tabs.map((tab) => {
    const rows = tab.rows
      .map((cells, r) => {
        const xml = cells
          .map((value, c) => {
            if (value === "") return "";
            if (inline.includes(tab.name)) return `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
            shared.push(value);
            return `<c r="${col(c)}${r + 1}" s="1" t="s"><v>${shared.length - 1}</v></c>`;
          })
          .join("");
        return xml ? `<row r="${r + 1}">${xml}</row>` : `<row r="${r + 1}"/>`;
      })
      .join("");
    return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  });
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs
      .map((t, i) => `<sheet name="${esc(t.name)}" sheetId="${i + 1}" r:id="rId${i + 10}"/>`)
      .join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships>${tabs
      .map((_, i) => `<Relationship Id="rId${i + 10}" Type="x/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  zip.file("xl/sharedStrings.xml", `<sst>${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`);
  sheets.forEach((xml, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml));
  return zip.generateAsync({ type: "uint8array" });
}

export const HEADER = ["Модуль", "Тема", "Підтема", "Опис", "Тип завдання"];
