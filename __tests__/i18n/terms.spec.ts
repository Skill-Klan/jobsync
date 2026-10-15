// @vitest-environment node
// Requirement — D34/D35 (owner, 2026-10-15): one word for one thing.
// Artificial intelligence is «AI», never «ШІ»; what a student attaches to
// jobs, questions and resumes is «навички», never «теги».
import { MESSAGES } from "@/i18n/messages";

type Tree = { [k: string]: string | Tree };
function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [[key, v] as [string, string]] : leaves(v, key);
  });
}

const uk = leaves(MESSAGES.uk as unknown as Tree);

// \b is ASCII-only in JS, so word starts are written out with \p{L}.
const SHI = /(?<!\p{L})ШІ(?!\p{L})/u;
const TAG = /(?<!\p{L})тег/iu;

describe("Ukrainian terms", () => {
  it("the patterns catch the word and nothing inside other words", () => {
    expect(SHI.test("Оцінка ШІ")).toBe(true);
    expect(TAG.test("Теги навичок")).toBe(true);
    expect(TAG.test("Назва тегу")).toBe(true);
    expect(TAG.test("Додати категорію")).toBe(false);
    expect(SHI.test("ШІСТЬ")).toBe(false);
  });

  it("AI is «AI»", () => {
    expect(uk.filter(([, v]) => SHI.test(v)).map(([k]) => k)).toEqual([]);
  });

  it("skills are «навички»", () => {
    expect(uk.filter(([, v]) => TAG.test(v)).map(([k]) => k)).toEqual([]);
  });
});
