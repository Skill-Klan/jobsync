// @vitest-environment node
// Requirement — the owner, 2026-10-18, finding the interview one needs
// (D67–D70):
//   · «by directories»: one folder per COMPANY — however its name is spelled in
//     different Drive folders — and inside it the recordings by stage, in the
//     order an interview goes: recruiter → technical → manager; a candidate's
//     sub-folder stays a folder inside its stage;
//   · first view — by company, the most recorded first (or A–Z);
//   · filters: direction (QA / BA), stage (several at once), company, search;
//     each option shows how many recordings choosing it would give;
//   · the filters live in the page address: a mentor sends a link, the student
//     opens the same selection; a broken or old link does not break the page.
import {
  NO_FILTERS,
  companyKey,
  companyNames,
  companyOptions,
  directionCounts,
  filterRecordings,
  filtersToParams,
  groupByCompany,
  hasCyrillic,
  parseFilters,
  stageCounts,
  type Filters,
  type LibraryRecording,
} from "@/skillklan/recordingsLibrary";

const rec = (id: string, kind: LibraryRecording["kind"], company: string | null, extra: Partial<LibraryRecording> = {}): LibraryRecording => ({
  id, kind, company, mimeType: "audio/mpeg", date: null, specializations: [], person: null, title: id, folder: null, ...extra,
});

// In the order the server sends them: newest first.
const LIBRARY: LibraryRecording[] = [
  rec("raifTech1", "qaTech", "RaiffeisenBank", { person: "Олена Коваль" }),
  rec("privBaRec", "baRecruiter", "PrivatBank", { person: "Дарина Бойко" }),
  rec("raifRec1", "qaRecruiter", "Raiffeisen Bank"),
  rec("raifMgr1", "qaManager", "RaiffeisenBank"),
  rec("raifTech2", "qaTech", "RaiffeisenBank", { title: "ч1", folder: "Олег_Мельник_AQA" }),
  rec("privTech1", "qaTech", "PrivatBank", { title: "Богдан_Руденко_QA" }),
  rec("raifTech3", "qaTech", "raiffeisen-bank"),
  rec("ajaxTech1", "qaTech", "Ajax"),
];
const f = (patch: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...patch });
const ids = (rs: LibraryRecording[]) => rs.map((r) => r.id);

describe("one folder per company", () => {
  it("spellings of one company are one company; different companies stay apart", () => {
    expect(companyKey("RaiffeisenBank")).toBe(companyKey("Raiffeisen Bank"));
    expect(companyKey("RaiffeisenBank")).toBe(companyKey("raiffeisen-bank"));
    expect(companyKey("PrivatBank")).not.toBe(companyKey("Raiffeisen Bank"));
    expect(companyKey("Київстар")).toBe(companyKey("КИЇВСТАР "));
  });

  it("a company's recordings from every stage and spelling are in its one folder, named as most of them spell it", () => {
    const raif = groupByCompany(LIBRARY, "count").find((g) => g.key === companyKey("RaiffeisenBank"))!;
    expect(raif.name).toBe("RaiffeisenBank");
    expect(raif.total).toBe(5);
    expect(raif.counts).toEqual({ recruiter: 1, tech: 3, manager: 1 });
  });

  it("a folder keeps its name whatever the filters leave — even when only a differently spelled recording is left", () => {
    const recruiterOnly = filterRecordings(LIBRARY, f({ stages: ["recruiter"], company: "raiffeisenbank" }));
    expect(ids(recruiterOnly)).toEqual(["raifRec1"]); // spelled «Raiffeisen Bank»
    expect(groupByCompany(recruiterOnly, "count", companyNames(LIBRARY)).map((g) => g.name)).toEqual(["RaiffeisenBank"]);
    expect(companyOptions(LIBRARY, f({ stages: ["recruiter"] })).find((o) => o.key === "raiffeisenbank")?.name).toBe("RaiffeisenBank");
  });

  it("inside: recruiter → technical → manager, whatever order they came in; newest first within a stage", () => {
    const raif = groupByCompany(LIBRARY, "count")[0];
    expect(raif.stages.map((s) => s.stage)).toEqual(["recruiter", "tech", "manager"]);
    expect(ids(raif.stages[1].recordings)).toEqual(["raifTech1", "raifTech3"]);
  });

  it("a candidate's sub-folder stays a folder inside its stage", () => {
    const tech = groupByCompany(LIBRARY, "count")[0].stages[1];
    expect(tech.folders).toEqual([{ name: "Олег_Мельник_AQA", recordings: [expect.objectContaining({ id: "raifTech2" })] }]);
    expect(ids(tech.recordings)).not.toContain("raifTech2");
  });

  it("the most recorded company first; A–Z on request", () => {
    expect(groupByCompany(LIBRARY, "count").map((g) => g.name)).toEqual(["RaiffeisenBank", "PrivatBank", "Ajax"]);
    expect(groupByCompany(LIBRARY, "name").map((g) => g.name)).toEqual(["Ajax", "PrivatBank", "RaiffeisenBank"]);
  });

  it("which directions a company has — QA, BA or both", () => {
    const groups = groupByCompany(LIBRARY, "count");
    expect(groups.find((g) => g.name === "PrivatBank")!.directions).toEqual(["qa", "ba"]);
    expect(groups.find((g) => g.name === "Ajax")!.directions).toEqual(["qa"]);
  });
});

describe("filters", () => {
  it("direction", () => {
    expect(ids(filterRecordings(LIBRARY, f({ direction: "ba" })))).toEqual(["privBaRec"]);
  });

  it("stages — any of the chosen ones", () => {
    expect(ids(filterRecordings(LIBRARY, f({ stages: ["recruiter", "manager"] })))).toEqual(["privBaRec", "raifRec1", "raifMgr1"]);
  });

  it("company — every spelling of it", () => {
    expect(ids(filterRecordings(LIBRARY, f({ company: companyKey("Raiffeisen Bank") })))).toEqual([
      "raifTech1", "raifRec1", "raifMgr1", "raifTech2", "raifTech3",
    ]);
  });

  it("search — the name, the person, the company and the sub-folder", () => {
    expect(ids(filterRecordings(LIBRARY, f({ query: "руденко" })))).toEqual(["privTech1"]);
    expect(ids(filterRecordings(LIBRARY, f({ query: "коваль" })))).toEqual(["raifTech1"]);
    expect(ids(filterRecordings(LIBRARY, f({ query: "ajax" })))).toEqual(["ajaxTech1"]);
    // Only its folder says «Мельник» — the name of the file is «ч1».
    expect(ids(filterRecordings(LIBRARY, f({ query: "мельник" })))).toEqual(["raifTech2"]);
  });

  it("all together: every filter must hold", () => {
    expect(ids(filterRecordings(LIBRARY, f({ direction: "qa", stages: ["tech"], company: "privatbank" })))).toEqual(["privTech1"]);
  });

  it("each option's number is what choosing it would show — the other filters on, its own off", () => {
    const filters = f({ direction: "qa", stages: ["tech"] });
    // Stage numbers ignore the stage filter, keep the direction.
    expect(stageCounts(LIBRARY, filters)).toEqual({ recruiter: 1, tech: 5, manager: 1 });
    // Direction numbers ignore the direction, keep the stage.
    expect(directionCounts(LIBRARY, filters)).toEqual({ qa: 5, ba: 0 });
    // Companies: what is left after the other filters, most recorded first.
    expect(companyOptions(LIBRARY, filters)).toEqual([
      { key: "raiffeisenbank", name: "RaiffeisenBank", count: 3 },
      { key: "ajax", name: "Ajax", count: 1 },
      { key: "privatbank", name: "PrivatBank", count: 1 },
    ]);
  });
});

describe("searched in Ukrainian (the hint to try English)", () => {
  it.each([
    ["приватбанк", true],
    ["Київстар", true],
    ["ПриватBank", true],
    ["їжак", true],
    // Only the letters Ukrainian has and Russian has not: [а-я] would miss them.
    ["ЇЄІҐ", true],
    ["privatbank", false],
    ["QA 2025", false],
    ["", false],
  ])("%j → %s", (query, expected) => {
    expect(hasCyrillic(query)).toBe(expected);
  });
});

describe("the filters in the page address", () => {
  it("a mentor's link opens the same selection", () => {
    const sent = f({ direction: "qa", stages: ["tech", "recruiter"], company: "privatbank", query: "руденко", view: "all", sort: "name", open: ["privatbank"] });
    const link = filtersToParams(sent).toString();
    expect(parseFilters(new URLSearchParams(link))).toEqual({ ...sent, stages: ["recruiter", "tech"] });
  });

  it("nothing chosen → a plain address", () => {
    expect(filtersToParams(NO_FILTERS).toString()).toBe("");
    expect(parseFilters(new URLSearchParams(""))).toEqual(NO_FILTERS);
  });

  it("an old or hand-made link: unknown values are dropped, a company in any spelling is found", () => {
    const parsed = parseFilters(new URLSearchParams("dir=pm&stage=tech,ceo,,recruiter&view=grid&sort=rand&company=Raiffeisen%20Bank&open=PrivatBank,,privatbank"));
    expect(parsed).toEqual({
      ...NO_FILTERS,
      stages: ["recruiter", "tech"],
      company: "raiffeisenbank",
      open: ["privatbank"],
    });
  });
});
