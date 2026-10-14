// @vitest-environment node
// Requirement — D29: every text exists in Ukrainian and in English. The two
// dictionaries carry the same keys and the same ICU arguments, nothing is
// empty, nothing is left untranslated, and every area file is registered.
import fs from "fs";
import path from "path";
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

// ICU argument names: {name}, {count, plural, ...}, {date, date, short}
function icuArgs(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/g)].map((m) => m[1]).sort();
}

const uk = leaves(MESSAGES.uk as unknown as Tree);
const en = leaves(MESSAGES.en as unknown as Tree);

// Strings that are the same in both languages on purpose.
const SAME_IN_BOTH = new Set<string>([]);

// Prompts whose English names the item ("Select stage") while the Ukrainian
// does not: the caller passes an English noun, and Ukrainian would have to
// decline it. Extra values are ignored, so dropping the argument is safe —
// adding one that English lacks is not, and stays forbidden.
const UK_DROPS_ARGS = new Set<string>([
  "common.comboBox.select",
  "common.comboBox.search",
  "common.comboBox.createOrSearch",
  "common.select.placeholder",
]);

describe("dictionaries", () => {
  it("uk and en have exactly the same keys", () => {
    expect([...uk.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it("every message keeps the same ICU arguments in both languages", () => {
    const mismatched = [...en.keys()].filter((k) => {
      if (!uk.has(k)) return false;
      const ukArgs = icuArgs(uk.get(k)!);
      const enArgs = icuArgs(en.get(k)!);
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
