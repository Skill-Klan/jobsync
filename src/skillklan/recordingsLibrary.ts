import type { RecordingKind } from "./recordingKinds";
import type { Attachment } from "./recordingAttachments";

// How the interview recordings library is filtered and laid out (owner
// 2026-10-18): filters — direction (QA / BA), interview stage, company and a
// search; the first view is «by company» — one folder per company, the
// recordings inside by stage (recruiter → technical → manager), a candidate's
// sub-folder nested; «all recordings» is the plain list. The filters live in
// the page address, so a mentor can send a student a ready selection.
//
// Pure — the library component uses it in the browser.

export type Direction = "qa" | "ba";
export type Stage = "recruiter" | "tech" | "manager";
export type View = "companies" | "all";
export type CompanySort = "count" | "name";

export const DIRECTIONS: readonly Direction[] = ["qa", "ba"];
// The order an interview goes in — and the order inside a company's folder.
export const STAGES: readonly Stage[] = ["recruiter", "tech", "manager"];

export type LibraryRecording = {
  id: string;
  kind: RecordingKind;
  mimeType: string;
  date: string | null;
  specializations: string[];
  person: string | null;
  company: string | null;
  title: string;
  folder?: string | null;
};

export function directionOf(kind: RecordingKind): Direction {
  return kind.startsWith("ba") ? "ba" : "qa";
}

export function stageOf(kind: RecordingKind): Stage {
  if (kind.endsWith("Recruiter")) return "recruiter";
  if (kind.endsWith("Tech")) return "tech";
  return "manager";
}

// One company may be spelled differently in different folders
// («RaiffeisenBank» / «Raiffeisen Bank», «N-iX» / «NIX»): letters and digits
// only, any case — one key. No company → "".
export function companyKey(name: string | null): string {
  return (name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

// Searched in Ukrainian? Most names in the library are in Latin letters (127
// of 135 company folders, 2026-10-18: «PrivatBank», not «ПриватБанк») — the
// owner: the search must suggest trying English too.
export function hasCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text);
}

export type Filters = {
  direction: Direction | null;
  stages: Stage[];
  company: string | null; // a companyKey
  query: string;
  view: View;
  sort: CompanySort;
  open: string[]; // companyKeys of the folders opened in the «by company» view
};

export const NO_FILTERS: Filters = {
  direction: null,
  stages: [],
  company: null,
  query: "",
  view: "companies",
  sort: "count",
  open: [],
};

const list = (value: string | null) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// The address → filters. Anything unknown is dropped, not trusted: the link
// may be old or typed by hand.
export function parseFilters(params: URLSearchParams): Filters {
  const direction = params.get("dir");
  const company = companyKey(params.get("company"));
  return {
    direction: DIRECTIONS.includes(direction as Direction) ? (direction as Direction) : null,
    stages: STAGES.filter((s) => list(params.get("stage")).includes(s)),
    company: company || null,
    query: params.get("q") ?? "",
    view: params.get("view") === "all" ? "all" : "companies",
    sort: params.get("sort") === "name" ? "name" : "count",
    open: [...new Set(list(params.get("open")).map(companyKey).filter(Boolean))],
  };
}

// Filters → the address; what is at its default is left out, so a plain
// visit stays a plain address.
export function filtersToParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.direction) params.set("dir", f.direction);
  if (f.stages.length > 0) params.set("stage", STAGES.filter((s) => f.stages.includes(s)).join(","));
  if (f.company) params.set("company", f.company);
  if (f.query.trim()) params.set("q", f.query.trim());
  if (f.view !== "companies") params.set("view", f.view);
  if (f.sort !== "count") params.set("sort", f.sort);
  if (f.open.length > 0) params.set("open", f.open.join(","));
  return params;
}

export function hasFilters(f: Filters): boolean {
  return Boolean(f.direction || f.stages.length > 0 || f.company || f.query.trim());
}

type Facet = "direction" | "stage" | "company";

// Does a recording pass the filters — all of them, or all but one facet (the
// counts next to a facet's own options ignore that facet, so they say what
// choosing an option would show).
export function matches(r: LibraryRecording, f: Filters, except?: Facet): boolean {
  if (except !== "direction" && f.direction && directionOf(r.kind) !== f.direction) return false;
  if (except !== "stage" && f.stages.length > 0 && !f.stages.includes(stageOf(r.kind))) return false;
  if (except !== "company" && f.company && companyKey(r.company) !== f.company) return false;
  const needle = f.query.trim().toLowerCase();
  if (!needle) return true;
  return [r.title, r.person, r.company, r.folder, ...r.specializations].some((v) =>
    v?.toLowerCase().includes(needle),
  );
}

export function filterRecordings(recordings: LibraryRecording[], f: Filters): LibraryRecording[] {
  return recordings.filter((r) => matches(r, f));
}

export function stageCounts(recordings: LibraryRecording[], f: Filters): Record<Stage, number> {
  const counts: Record<Stage, number> = { recruiter: 0, tech: 0, manager: 0 };
  for (const r of recordings) if (matches(r, f, "stage")) counts[stageOf(r.kind)]++;
  return counts;
}

export function directionCounts(recordings: LibraryRecording[], f: Filters): Record<Direction, number> {
  const counts: Record<Direction, number> = { qa: 0, ba: 0 };
  for (const r of recordings) if (matches(r, f, "direction")) counts[directionOf(r.kind)]++;
  return counts;
}

export type CompanyOption = { key: string; name: string | null; count: number };

// The company picker: every company the other filters leave, with how many
// recordings choosing it would show; the most recorded first.
export function companyOptions(recordings: LibraryRecording[], f: Filters): CompanyOption[] {
  const names = companyNames(recordings);
  return groupByCompany(recordings.filter((r) => matches(r, f, "company")), "count", names).map((g) => ({
    key: g.key,
    name: g.name,
    count: g.total,
  }));
}

const byName = (a: string | null, b: string | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a.localeCompare(b, "uk", { sensitivity: "base" });

// A company's name: the spelling most of its recordings carry — counted over
// the whole library, so a folder keeps its name whatever the filters leave.
export function companyNames(recordings: LibraryRecording[]): Map<string, string> {
  const spellings = new Map<string, Map<string, number>>();
  for (const r of recordings) {
    if (!r.company) continue;
    const key = companyKey(r.company);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(r.company, (counts.get(r.company) ?? 0) + 1);
    spellings.set(key, counts);
  }
  return new Map(
    [...spellings].map(([key, counts]) => [key, [...counts].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))[0][0]]),
  );
}

export type FolderGroup = { name: string; recordings: LibraryRecording[] };
export type StageGroup = { stage: Stage; recordings: LibraryRecording[]; folders: FolderGroup[] };
export type CompanyGroup = {
  key: string;
  name: string | null; // the spelling most of its recordings carry
  total: number;
  counts: Record<Stage, number>;
  directions: Direction[];
  stages: StageGroup[];
};

// The «by company» view. Recordings keep the order they come in (newest
// first, from the server) inside each stage and folder. `names` — from the
// whole library (companyNames); without it, from the recordings given.
export function groupByCompany(
  recordings: LibraryRecording[],
  sort: CompanySort,
  names: Map<string, string> = companyNames(recordings),
): CompanyGroup[] {
  const groups = new Map<string, LibraryRecording[]>();
  for (const r of recordings) {
    const key = companyKey(r.company);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const result = [...groups].map(([key, items]): CompanyGroup => {
    const name = names.get(key) ?? items.find((r) => r.company)?.company ?? null;
    const counts: Record<Stage, number> = { recruiter: 0, tech: 0, manager: 0 };
    for (const r of items) counts[stageOf(r.kind)]++;
    const stages = STAGES.flatMap((stage): StageGroup[] => {
      const inStage = items.filter((r) => stageOf(r.kind) === stage);
      if (inStage.length === 0) return [];
      const folders = new Map<string, LibraryRecording[]>();
      for (const r of inStage) if (r.folder) folders.set(r.folder, [...(folders.get(r.folder) ?? []), r]);
      return [
        {
          stage,
          recordings: inStage.filter((r) => !r.folder),
          folders: [...folders].map(([folder, rs]) => ({ name: folder, recordings: rs })),
        },
      ];
    });
    const directions = DIRECTIONS.filter((d) => items.some((r) => directionOf(r.kind) === d));
    return { key, name, total: items.length, counts, directions, stages };
  });
  return result.sort((a, b) =>
    sort === "name" ? byName(a.name, b.name) : b.total - a.total || byName(a.name, b.name),
  );
}

// Where the attachments go on the page (owner 2026-10-19, D77): beside their
// recording when that is certain, otherwise on their folder — a company's
// stage («Технічна» of Acme: what lies right in its folder) or a folder below
// it (a candidate's). A folder's attachments follow the direction filter like
// its recordings do; a recording's go wherever the recording is shown.
export const folderKey = (company: string, stage: Stage, folder: string | null): string =>
  `${company}|${stage}|${folder ?? ""}`;

export type AttachmentPlaces = {
  byRecording: Map<string, Attachment[]>;
  byFolder: Map<string, Attachment[]>;
};

export function attachmentPlaces(attachments: readonly Attachment[], f: Filters): AttachmentPlaces {
  const byRecording = new Map<string, Attachment[]>();
  const byFolder = new Map<string, Attachment[]>();
  const add = (map: Map<string, Attachment[]>, key: string, a: Attachment) =>
    map.set(key, [...(map.get(key) ?? []), a]);
  for (const a of attachments) {
    if (a.recordingId) add(byRecording, a.recordingId, a);
    else if (!f.direction || directionOf(a.kind) === f.direction) {
      add(byFolder, folderKey(companyKey(a.company), stageOf(a.kind), a.folder), a);
    }
  }
  return { byRecording, byFolder };
}
