// @vitest-environment node
// Requirement — D29: every text exists in Ukrainian and in English. The two
// dictionaries carry the same keys and the same ICU arguments, nothing is
// empty, nothing is left untranslated, and every area file is registered.
import fs from "fs";
import path from "path";
import { IntlMessageFormat } from "intl-messageformat";
import { MESSAGES } from "@/i18n/messages";

type Tree = { [k: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
  }
  return out;
}

// What the message asks the caller for, as the runtime sees it: use-intl
// formats with intl-messageformat, so the same parser reads the arguments —
// {name}, {count, plural, ...}, {date, date, short}, rich-text tags as <tag> —
// and nothing inside a plural/select branch or a quoted '{literal}' counts.
type Element = {
  type: number;
  value?: unknown;
  options?: Record<string, { value: Element[] }>;
  children?: Element[];
};
const LITERAL = 0;
const POUND = 7;
const TAG = 8;

function collect(elements: Element[], out: Set<string>) {
  for (const el of elements) {
    if (el.type === LITERAL || el.type === POUND) continue;
    if (el.type === TAG) {
      out.add(`<${el.value}>`);
      collect(el.children ?? [], out);
      continue;
    }
    out.add(String(el.value));
    for (const option of Object.values(el.options ?? {})) collect(option.value, out);
  }
}

function icuArgs(message: string, locale = "en"): string[] {
  const out = new Set<string>();
  collect(new IntlMessageFormat(message, locale).getAst() as Element[], out);
  return [...out].sort();
}

const uk = leaves(MESSAGES.uk as unknown as Tree);
const en = leaves(MESSAGES.en as unknown as Tree);

// Strings that are the same in both languages on purpose.
const SAME_IN_BOTH = new Set<string>([
  // The professions' names: QA and BA in Ukrainian too.
  "interviews.recordings.directions.qa",
  "interviews.recordings.directions.ba",
]);

// Prompts whose English names the item ("Select stage") while the Ukrainian
// does not: the caller passes an English noun, and Ukrainian would have to
// decline it. Extra values are ignored, so dropping the argument is safe —
// adding one that English lacks is not, and stays forbidden.
const UK_DROPS_ARGS = new Set<string>([
  "common.comboBox.select",
  "common.comboBox.search",
  "common.comboBox.createOrSearch",
  "common.select.placeholder",
  // The record counter: English "of 121 jobs", Ukrainian numbers only.
  "common.records.ofTotal",
  "common.records.shown",
]);

describe("reading ICU arguments", () => {
  it("finds plain, formatted, plural and select arguments, and tags", () => {
    expect(icuArgs("Hi {name}, {n, number} on {d, date, short}")).toEqual(["d", "n", "name"]);
    expect(icuArgs("{count, plural, one {# job by {who}} other {# jobs}}")).toEqual(["count", "who"]);
    expect(icuArgs("{kind, select, a {A} other {B}}")).toEqual(["kind"]);
    expect(icuArgs("Go to <settings>Settings</settings>")).toEqual(["<settings>"]);
  });

  it("does not take a plural branch word for an argument", () => {
    expect(icuArgs("{count, plural, one {job} other {jobs}}")).toEqual(["count"]);
  });

  it("does not take a quoted literal for an argument", () => {
    expect(icuArgs("Type '{name}' here")).toEqual([]);
    expect(icuArgs("It''s {name}")).toEqual(["name"]);
  });

  it("names a repeated argument once", () => {
    expect(icuArgs("{n} of {n}")).toEqual(["n"]);
  });
});

describe("dictionaries", () => {
  it("every message parses in its own language", () => {
    const broken: string[] = [];
    for (const [locale, tree] of [["uk", uk], ["en", en]] as const) {
      for (const [k, v] of tree) {
        try {
          new IntlMessageFormat(v, locale);
        } catch {
          broken.push(`${locale}:${k}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("uk and en have exactly the same keys", () => {
    expect([...uk.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it("every message keeps the same ICU arguments in both languages", () => {
    const mismatched = [...en.keys()].filter((k) => {
      if (!uk.has(k)) return false;
      const ukArgs = icuArgs(uk.get(k)!, "uk");
      const enArgs = icuArgs(en.get(k)!, "en");
      if (UK_DROPS_ARGS.has(k)) return ukArgs.some((a) => !enArgs.includes(a));
      return ukArgs.join() !== enArgs.join();
    });
    expect(mismatched).toEqual([]);
  });

  it("no message is empty", () => {
    const empty = [...uk, ...en].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("nothing is left untranslated (uk equal to en)", () => {
    const same = [...en.keys()].filter((k) => uk.get(k) === en.get(k) && !SAME_IN_BOTH.has(k));
    expect(same).toEqual([]);
  });

  it("every area file is registered, for both languages", () => {
    for (const locale of ["uk", "en"] as const) {
      const dir = path.join(process.cwd(), "src/i18n/messages", locale);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
      expect(files).toEqual(Object.keys(MESSAGES[locale]).sort());
    }
  });
});
