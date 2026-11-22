import JSZip from "jszip";

// Reading a study-plan spreadsheet: the school keeps one workbook per track, a
// tab per student (a copy of the «Шаблон плану» tab named after the student),
// and a mentor writes «Залік» in the «Тип завдання» column of a point the
// student has passed. Only that mark is read — never the topic status column
// (it is not kept up to date), the homework links or the dates.
//
// No spreadsheet library: an .xlsx is a zip of XML files, and the few parts
// read here (the tab list, the shared strings, the cells) are plain.

export const SHEET_MAX_BYTES = 4 * 1024 * 1024;
const PART_MAX_BYTES = 30 * 1024 * 1024; // a part's size once unpacked

// Tabs that are not a student's.
const SERVICE_TABS = new Set(["шаблон плану", "дз", "дз (v1)"]);
const PASSED = "залік";

export type PassedRow = { topic: string; text: string };
export type StudentTab = {
  name: string;
  // The name before the bracket: «Павло (roman_t)» → «Павло».
  firstName: string;
  // What is in the bracket, if anything — a hint about the mentor.
  hint: string;
  // Every point of the tab, in order, with the mark.
  rows: (PassedRow & { passed: boolean })[];
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
}

// The text of a string item or an inline string: its <t> parts joined, without
// the phonetic hints.
function textOf(xml: string): string {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of clean.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXml(out);
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? "") n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

async function part(zip: JSZip, name: string): Promise<string | null> {
  const file = zip.file(name);
  if (!file) return null;
  const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size === "number" && size > PART_MAX_BYTES) throw new Error("part too large");
  return file.async("string");
}

type Rows = Map<number, Map<number, string>>;

function parseRows(xml: string, strings: string[]): Rows {
  const rows: Rows = new Map();
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attr(rowMatch[1], "r"));
    if (!Number.isInteger(rowNumber) || !rowMatch[2]) continue;
    const cells = new Map<number, string>();
    for (const c of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], "r");
      if (!ref || c[2] === undefined) continue;
      const type = attr(c[1], "t");
      let value: string | null = null;
      if (type === "inlineStr") value = textOf(c[2]);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1];
        if (v !== undefined) value = type === "s" ? (strings[Number(v)] ?? "") : unescapeXml(v);
      }
      if (value !== null) cells.set(columnIndex(ref), value);
    }
    rows.set(rowNumber, cells);
  }
  return rows;
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

// The student tabs of a workbook. A tab is a student's when it has the plan's
// header («Опис» in the fourth column) and is not a service tab.
export async function readStudentTabs(data: ArrayBuffer | Uint8Array): Promise<StudentTab[]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength === 0 || bytes.byteLength > SHEET_MAX_BYTES) throw new Error("bad size");
  const zip = await JSZip.loadAsync(bytes);
  const [book, rels, shared] = await Promise.all([
    part(zip, "xl/workbook.xml"),
    part(zip, "xl/_rels/workbook.xml.rels"),
    part(zip, "xl/sharedStrings.xml"),
  ]);
  if (!book || !rels) throw new Error("not a workbook");
  const strings = shared ? [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attr(m[1], "Id");
    const target = attr(m[1], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const tabs: StudentTab[] = [];
  for (const m of book.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = clean(attr(m[1], "name") ?? "");
    const target = targets.get(attr(m[1], "r:id") ?? "");
    if (!name || !target || SERVICE_TABS.has(name.toLowerCase())) continue;
    const xml = await part(zip, target);
    if (!xml) continue;
    const rows = parseRows(xml, strings);
    const numbers = [...rows.keys()].sort((a, b) => a - b);
    const header = numbers.find((n) => clean(rows.get(n)?.get(3)) === "Опис");
    if (header === undefined) continue;
    let topic = "";
    const points: StudentTab["rows"] = [];
    for (const n of numbers) {
      if (n <= header) continue;
      const cells = rows.get(n)!;
      if (clean(cells.get(1))) topic = clean(cells.get(1));
      const text = clean(cells.get(3));
      if (text) points.push({ topic, text, passed: clean(cells.get(4)).toLowerCase() === PASSED });
    }
    const bracket = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
    tabs.push({ name, firstName: bracket ? bracket[1].trim() : name, hint: bracket ? bracket[2].trim() : "", rows: points });
  }
  return tabs;
}

export type TemplatePoint = { id: string; topic: string; text: string; done: boolean };

const key = (topic: string, text: string) => `${clean(topic)}\n${clean(text)}`;

// Which points of a student's plan the tab marks as passed. A point is found by
// its topic and its text; if the same pair repeats, the first of the tab goes
// with the first of the plan, and so on. The tab's passed rows that find no
// point are returned too, so nothing is dropped without being seen.
export function matchPassed(
  points: TemplatePoint[],
  rows: StudentTab["rows"],
): { ids: string[]; alreadyDone: number; missing: PassedRow[] } {
  const free = new Map<string, TemplatePoint[]>();
  for (const p of points) {
    const k = key(p.topic, p.text);
    free.set(k, [...(free.get(k) ?? []), p]);
  }
  const ids: string[] = [];
  const missing: PassedRow[] = [];
  let alreadyDone = 0;
  for (const row of rows) {
    const point = free.get(key(row.topic, row.text))?.shift();
    if (!row.passed) continue;
    if (!point) missing.push({ topic: row.topic, text: row.text });
    else if (point.done) alreadyDone += 1;
    else ids.push(point.id);
  }
  return { ids, alreadyDone, missing };
}
