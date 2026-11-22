// @vitest-environment node
// Requirement — the owner, 2026-11-22 (SKD-60): the school's workbook has a tab
// per student (a copy of «Шаблон плану» named after the student); the mentor
// writes «Залік» in «Тип завдання» on a point the student has passed. Reading it:
//   · a student tab is one with the plan's header; «Шаблон плану» and the
//     homework tabs are not students;
//   · «Павло (mentor_x)» → first name «Павло», hint «mentor_x»; no bracket → no hint;
//   · a point is passed only by «Залік» in its own row — not by a topic status,
//     not by «Практика»/«Теорія», not by a blank;
//   · a point is found in a plan by its topic and its text; the same pair twice
//     goes first-with-first; a passed row that finds nothing is reported, never
//     dropped, and a ticked point is never counted as new.
import JSZip from "jszip";
import { readStudentTabs, matchPassed, SHEET_MAX_BYTES } from "@/skillklan/plans/sheetImport";
import { HEADER, makeWorkbook } from "../helpers/makeWorkbook";

const student = (name: string) => ({
  name,
  rows: [
    HEADER,
    ["Модуль 1", "", "", "", ""],
    ["", "Тема 1: Основи", "", "", ""],
    ["", "", "SDLC", "Що таке SDLC", "Залік"],
    ["", "", "", "Етапи SDLC", "Практика"],
    ["", "", "", "Моделі & методи", "залік "],
    ["", "Тема 2: Git", "", "", ""],
    ["", "", "Git", "Що таке Git", "Теорія"],
    ["", "", "", "Гілки", ""],
  ],
});

describe("reading student tabs", () => {
  it("takes student tabs, leaves the template and homework tabs out, and reads names", async () => {
    const data = await makeWorkbook([
      { name: "ДЗ", rows: [["ДЗ1"]] },
      { name: "Шаблон плану", rows: student("x").rows },
      student("Павло (mentor_x)"),
      student("Марія"),
      { name: "ДЗ (v1)", rows: [["ДЗ1"], ["1. Питання"]] },
    ]);
    const tabs = await readStudentTabs(data);
    expect(tabs.map((t) => [t.name, t.firstName, t.hint])).toEqual([
      ["Павло (mentor_x)", "Павло", "mentor_x"],
      ["Марія", "Марія", ""],
    ]);
  });

  it("reads rows with the topic they sit under, and marks only «Залік» as passed (any case, trimmed)", async () => {
    const [tab] = await readStudentTabs(await makeWorkbook([student("Ігор(Борис)")]));
    expect(tab.rows).toEqual([
      { topic: "Тема 1: Основи", text: "Що таке SDLC", passed: true },
      { topic: "Тема 1: Основи", text: "Етапи SDLC", passed: false },
      { topic: "Тема 1: Основи", text: "Моделі & методи", passed: true },
      { topic: "Тема 2: Git", text: "Що таке Git", passed: false },
      { topic: "Тема 2: Git", text: "Гілки", passed: false },
    ]);
  });

  it("reads inline strings as well as shared ones", async () => {
    const data = await makeWorkbook([student("Олена (Максим)")], ["Олена (Максим)"]);
    const [tab] = await readStudentTabs(data);
    expect(tab.rows.filter((r) => r.passed)).toHaveLength(2);
  });

  it("refuses what is not a workbook, and an empty or oversized file", async () => {
    await expect(readStudentTabs(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    await expect(readStudentTabs(new Uint8Array(0))).rejects.toThrow();
    await expect(readStudentTabs(new Uint8Array(SHEET_MAX_BYTES + 1))).rejects.toThrow();
  });

  // Review fix (SKD-67): the archive's own table is read before anything is
  // unpacked — a workbook of thousands of entries is refused, an ordinary one is not.
  it("refuses a workbook with too many entries before unpacking it, and reads an ordinary one (paired)", async () => {
    const ordinary = await makeWorkbook([student("Олена (Максим)")]);
    expect(await readStudentTabs(ordinary)).toHaveLength(1);

    const zip = await JSZip.loadAsync(ordinary);
    for (let i = 0; i < 1001; i++) zip.file(`xl/media/x${i}.xml`, "x");
    const bomb = await zip.generateAsync({ type: "uint8array" });
    await expect(readStudentTabs(bomb)).rejects.toThrow(/too large/);
  });
});

describe("finding the passed points in a plan", () => {
  const point = (id: string, topic: string, text: string, done = false) => ({ id, topic, text, done });
  const row = (topic: string, text: string, passed: boolean) => ({ topic, text, passed });

  it("returns the points a passed row names, not the ones it does not", () => {
    const found = matchPassed(
      [point("a", "T1", "x"), point("b", "T1", "y"), point("c", "T2", "x")],
      [row("T1", "x", true), row("T1", "y", false), row("T2", "x", true)],
    );
    expect(found).toEqual({ ids: ["a", "c"], alreadyDone: 0, missing: [] });
  });

  it("does not count a ticked point as new, and does not need it ticked again", () => {
    const found = matchPassed([point("a", "T1", "x", true), point("b", "T1", "y")], [row("T1", "x", true), row("T1", "y", true)]);
    expect(found).toMatchObject({ ids: ["b"], alreadyDone: 1 });
  });

  it("reports a passed row the plan does not have, and ignores an unpassed one it does not have", () => {
    const found = matchPassed([point("a", "T1", "x")], [row("T1", "x", true), row("T1", "old text", true), row("T1", "gone", false)]);
    expect(found).toEqual({ ids: ["a"], alreadyDone: 0, missing: [{ topic: "T1", text: "old text" }] });
  });

  it("the same topic and text twice go first with first", () => {
    const found = matchPassed([point("a", "T", "x"), point("b", "T", "x")], [row("T", "x", false), row("T", "x", true)]);
    expect(found.ids).toEqual(["b"]);
  });

  it("the same text under another topic is another point", () => {
    expect(matchPassed([point("a", "T1", "x"), point("b", "T2", "x")], [row("T2", "x", true)]).ids).toEqual(["b"]);
  });
});
