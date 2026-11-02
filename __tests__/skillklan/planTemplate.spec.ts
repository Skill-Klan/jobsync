// @vitest-environment node
// Requirement — product notes, 2026-11-02: a plan template is a file in the
// repository, one per track (Java first), copied from the school's Excel
// sheets «Шаблон» and «ДЗ»:
//   · module → topic → subtopic → point; each topic may carry a material link;
//   · a topic's homework is a list of sub-tasks, each ticked on its own;
//   · a homework shared by several topics (ДЗ 19, ДЗ 21) is written once, under
//     the first topic; the others only point to it;
//   · names stay as in Excel, only the 📱 emoji is gone;
//   · a template that breaks the shape is refused when the app starts, not when
//     a student opens it.
import { getPlanTemplate, PLAN_TRACKS, PlanNode, validatePlanTemplate } from "@/skillklan/plans/template";

function walk(nodes: PlanNode[], visit: (n: PlanNode, depth: number) => void, depth = 1): void {
  for (const n of nodes) {
    visit(n, depth);
    walk(n.children ?? [], visit, depth + 1);
  }
}

const java = getPlanTemplate("java")!;

describe("the Java template", () => {
  it("is the first of the tracks", () => {
    expect(PLAN_TRACKS).toEqual(["java", "javascript", "python", "manual"]);
    expect(java.track).toBe("java");
    expect(java.title).toBe("Java");
  });

  it("has the eight modules in a row (the sheet skips 7), without the 📱 emoji", () => {
    expect(java.children.map((m) => m.title.split(/[.:]/)[0])).toEqual([
      "Модуль 1", "Модуль 2", "Модуль 3", "Модуль 4", "Модуль 5", "Модуль 6", "Модуль 7", "Модуль 8",
    ]);
    const titles: string[] = [];
    walk(java.children, (n) => titles.push(n.title));
    expect(titles.filter((t) => t.includes("📱"))).toEqual([]);
  });

  it("has 32 topics: 4+4+4+3+3+5 in the first six modules, 4 and 5 in the last two", () => {
    expect(java.children.map((m) => m.children!.length)).toEqual([4, 4, 4, 3, 3, 5, 4, 5]);
  });

  it("writes each of ДЗ 1–22 once; every other mention is a pointer to a ДЗ written before it", () => {
    const written: number[] = [];
    const pointers: number[] = [];
    walk(java.children, (n) => {
      const num = Number(/^ДЗ (\d+)/.exec(n.title)?.[1]);
      if (n.kind === "homework") written.push(num);
      if (n.kind === "homework_ref") {
        expect(written).toContain(num);
        pointers.push(num);
      }
    });
    expect([...written].sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(pointers.sort()).toEqual([19, 19, 19, 19, 21]);
  });

  it("gives every homework at least one sub-task, and a link to the material on topics only", () => {
    walk(java.children, (n) => {
      if (n.kind === "homework") expect(n.children!.length).toBeGreaterThan(0);
      if (n.materialUrl) expect(n.kind).toBe("topic");
    });
  });

  it("keeps the glued sheet cells apart: ДЗ 8 extra, ДЗ 15 recap and the code sample", () => {
    const tasks: string[] = [];
    walk(java.children, (n) => n.kind === "homework_task" && tasks.push(n.title));
    expect(tasks.some((t) => t.startsWith("ДОДАТКОВО:"))).toBe(true);
    expect(tasks.some((t) => t.startsWith("Переплетення з попередніми темами:"))).toBe(true);
    const post = tasks.find((t) => t.includes("```java"))!;
    expect(post.match(/```/g)).toHaveLength(2);
  });
});

// Requirement — the owner, 2026-11-03: plans for JavaScript, Python and manual
// testing from the school's sheets, "with the numbering bug fixed" (the sheets
// go from Module 6 to Module 8) and "the topics and homework that belong to
// another language corrected":
//   · every track numbers its modules 1, 2, 3 … in a row, whatever the sheet says;
//   · a homework sub-task is numbered as in the sheet, so none is glued to the
//     one before it; the two unnumbered extras are the only exceptions;
//   · a homework is written once; the other mentions point to it, after it;
//   · a track holds nothing of another language: no Java tools in JavaScript or
//     Python, no Selenium or TestNG in JavaScript, no automation in Manual QA.
const ALL_TRACKS = ["java", "javascript", "python", "manual"] as const;
const tracks = Object.fromEntries(ALL_TRACKS.map((t) => [t, getPlanTemplate(t)!])) as Record<(typeof ALL_TRACKS)[number], NonNullable<ReturnType<typeof getPlanTemplate>>>;
const titlesOf = (t: { children: PlanNode[] }) => {
  const titles: string[] = [];
  walk(t.children, (n) => titles.push(n.title));
  return titles;
};
const homeworkNumbers = (t: { children: PlanNode[] }, kind: "homework" | "homework_ref") => {
  const out: number[] = [];
  walk(t.children, (n) => n.kind === kind && out.push(Number(/^ДЗ (\d+)/.exec(n.title)![1])));
  return out;
};

describe("every track", () => {
  it.each(ALL_TRACKS)("%s: the modules are numbered 1, 2, 3 … without a gap", (name) => {
    const numbers = tracks[name].children.map((m) => Number(/^Модуль (\d+)[.:]/.exec(m.title)?.[1]));
    expect(numbers).toEqual(tracks[name].children.map((_, i) => i + 1));
  });

  it.each(ALL_TRACKS)("%s: every sub-task starts with its number, but the two extras", (name) => {
    const odd: string[] = [];
    walk(tracks[name].children, (n) => {
      if (n.kind === "homework_task" && !/^\d+(\.\d+)*\.\s/.test(n.title)) odd.push(n.title.split(/[:\n]/)[0]);
    });
    expect(odd.filter((t) => t !== "ДОДАТКОВО" && t !== "Переплетення з попередніми темами")).toEqual([]);
  });

  it.each(ALL_TRACKS)("%s: a homework is written once; a pointer follows what it points to", (name) => {
    const written = homeworkNumbers(tracks[name], "homework");
    expect(new Set(written).size).toBe(written.length);
    for (const pointer of homeworkNumbers(tracks[name], "homework_ref")) expect(written).toContain(pointer);
  });

  it.each(ALL_TRACKS)("%s: no empty point or leftover «?» from the sheet", (name) => {
    expect(titlesOf(tracks[name]).filter((t) => t.trim() === "" || /\s\?$/.test(t))).toEqual([]);
  });

  it("Java: the getters and setters of ДЗ 7 are a task of their own, as in the sheet", () => {
    let tasks: string[] = [];
    walk(java.children, (n) => n.title === "ДЗ 7" && (tasks = n.children!.map((c) => c.title)));
    expect(tasks).toHaveLength(8);
    expect(tasks[1]).toBe("2. Додай геттери та сеттери для кожного поля.");
    expect(tasks[0]).not.toMatch(/геттери/);
  });
});

describe("the JavaScript track", () => {
  const js = tracks.javascript;

  it("is called JavaScript and has the eight modules in a row, mobile 7 and databases 8", () => {
    expect([js.track, js.title]).toEqual(["javascript", "JavaScript"]);
    expect(js.children.slice(-2).map((m) => m.title)).toEqual([
      "Модуль 7: Основи мобільного тестування",
      "Модуль 8: Основи баз даних",
    ]);
  });

  it("writes ДЗ 1–22 once each, with the same pointers as Java", () => {
    expect(homeworkNumbers(js, "homework").sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(homeworkNumbers(js, "homework_ref").sort()).toEqual([19, 19, 19, 19, 21]);
  });

  it("teaches Playwright where Java had Selenium and TestNG, and has nothing of Java", () => {
    const all = titlesOf(js).join("\n");
    expect(all).not.toMatch(/\bJava\b|TestNG|Maven|PageFactory|RestAssured|HashSet|HashMap|ArrayList|JDK|IntelliJ|DataProvider|Selenium|ChromeDriver|@Test|SoftAssert/);
    expect(all).toMatch(/Playwright Test runner/);
    expect(all).toMatch(/expect\.soft/);
  });

  it("ДЗ 22 (Charles) has its seven steps as numbered tasks, ДЗ 20 no stray letter", () => {
    let charles: string[] = [];
    let mobile: string[] = [];
    walk(js.children, (n) => {
      if (n.title === "ДЗ 22") charles = n.children!.map((c) => c.title);
      if (n.title === "ДЗ 20") mobile = n.children!.map((c) => c.title);
    });
    expect(charles).toHaveLength(7);
    expect(charles[0]).toMatch(/^1\. Встановіть Charles/);
    expect(mobile[3]).toMatch(/\(Android, iOS\)$/);
  });
});

describe("the Python track", () => {
  const py = tracks.python;

  it("is called Python and has the eight modules in a row", () => {
    expect([py.track, py.title]).toEqual(["python", "Python"]);
    expect(py.children).toHaveLength(8);
  });

  it("writes ДЗ 1–22 once each, with the same pointers as Java", () => {
    expect(homeworkNumbers(py, "homework").sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(homeworkNumbers(py, "homework_ref").sort()).toEqual([19, 19, 19, 19, 21]);
  });

  it("has nothing of Java left: its tools, its classes, its collections", () => {
    const all = titlesOf(py).join("\n");
    expect(all).not.toMatch(/\bJava\b|TestNG|Maven|pom\.xml|PageFactory|RestAssured|HashSet|HashMap|ArrayList|JDK|IntelliJ|DataProvider|@Test|@BeforeMethod|SoftAssert|InvalidPriceException/);
  });

  it("splits the language in two as the other tracks do: topic 3 the core, topic 4 files, errors and first tests", () => {
    const [m1] = py.children;
    const t3 = m1.children![2].children!.map((g) => g.title);
    const t4 = m1.children![3].children!.map((g) => g.title);
    expect(t3).toEqual(expect.arrayContaining(["Умови й цикли", "Функції та області видимості"]));
    expect(t4).toEqual(expect.arrayContaining(["Колекції (list, tuple, set, dict)", "Обробка помилок", "Робота з файлами"]));
    // «Робота з файлами» was in the sheet twice, and «Функції та області видимості» under two parents.
    expect([...t3, ...t4].filter((t, i, all) => all.indexOf(t) !== i)).toEqual([]);
  });

  it("gives ДЗ 3 a match-case to go with its switch task", () => {
    expect(titlesOf(py).some((t) => /match-case/.test(t))).toBe(true);
  });
});

describe("the Manual QA track", () => {
  const manual = tracks.manual;

  it("is called Manual QA and has six modules in a row, whichever numbers the sheet gave", () => {
    expect([manual.track, manual.title]).toEqual(["manual", "Manual QA"]);
    expect(manual.children.map((m) => m.title.split(/[.:]/)[0])).toEqual([
      "Модуль 1", "Модуль 2", "Модуль 3", "Модуль 4", "Модуль 5", "Модуль 6",
    ]);
  });

  it("has the manual homework only: no coding, no Appium", () => {
    expect(homeworkNumbers(manual, "homework").sort((a, b) => a - b)).toEqual([1, 2, 5, 6, 13, 14, 19, 20, 22]);
    expect(homeworkNumbers(manual, "homework_ref")).toEqual([19, 19, 19, 19]);
  });

  it("has no automation among its topics", () => {
    const all = titlesOf(manual).join("\n");
    expect(all).not.toMatch(/автоматизован|RestAssured|Selenium|TestNG|Playwright|Appium|\bJava\b|Maven/i);
  });

  it("keeps the material links of the sheet on its topics", () => {
    const links: string[] = [];
    walk(manual.children, (n) => n.materialUrl && links.push(n.materialUrl));
    expect(links.length).toBeGreaterThanOrEqual(15);
    expect(links.every((l) => l.startsWith("https://docs.skillklan.com.ua/"))).toBe(true);
  });
});

describe("the template shape rule", () => {
  const ok = () => ({
    track: "go",
    title: "Go",
    children: [
      {
        kind: "module",
        title: "M",
        children: [
          {
            kind: "topic",
            title: "T",
            materialUrl: "https://docs.example.test/t",
            children: [
              { kind: "group", title: "G", children: [{ kind: "item", title: "P" }] },
              { kind: "homework", title: "ДЗ 1", children: [{ kind: "homework_task", title: "1. Do" }] },
            ],
          },
        ],
      },
    ],
  });
  const topic = (t: ReturnType<typeof ok>) => t.children[0].children[0] as Record<string, unknown> & { children: Record<string, unknown>[] };

  it("accepts a well-formed template", () => {
    expect(validatePlanTemplate(ok()).track).toBe("go");
  });

  it.each([
    ["an unknown kind", (t: ReturnType<typeof ok>) => (topic(t).children[0].kind = "chapter"), /unknown kind/],
    ["a topic directly under the root", (t: ReturnType<typeof ok>) => (t.children[0].kind = "topic"), /topic cannot be under root/],
    ["a point under a module", (t: ReturnType<typeof ok>) => t.children[0].children.push({ kind: "item", title: "x" } as never), /item cannot be under module/],
    ["a group inside a group", (t: ReturnType<typeof ok>) => (topic(t).children[0].children as unknown[]).push({ kind: "group", title: "x", children: [] }), /group cannot be under group/],
    ["an empty title", (t: ReturnType<typeof ok>) => (topic(t).title = "  "), /empty title/],
    ["a material link on a module", (t: ReturnType<typeof ok>) => ((t.children[0] as Record<string, unknown>).materialUrl = "https://x.test"), /only a topic/],
    ["a material link that is not a URL", (t: ReturnType<typeof ok>) => (topic(t).materialUrl = "❌ матеріал відсутній"), /not an http/],
    ["a point with parts", (t: ReturnType<typeof ok>) => ((topic(t).children[0].children as Record<string, unknown>[])[0].children = [{ kind: "item", title: "x" }]), /item has no parts/],
    ["an empty homework", (t: ReturnType<typeof ok>) => (topic(t).children[1].children = []), /homework is empty/],
    ["a track that is not a slug", (t: ReturnType<typeof ok>) => (t.track = "Java 8"), /not a lowercase slug/],
  ])("refuses %s", (_name, break_, message) => {
    const t = ok();
    break_(t);
    expect(() => validatePlanTemplate(t)).toThrow(message);
  });

  it("refuses a template with no modules", () => {
    expect(() => validatePlanTemplate({ track: "go", title: "Go", children: [] })).toThrow(/no modules/);
    expect(() => validatePlanTemplate(null)).toThrow(/not an object/);
  });
});

describe("looking a template up", () => {
  it("finds a track and nothing else, object keys included", () => {
    expect(getPlanTemplate("java")).not.toBeNull();
    expect(getPlanTemplate("go")).toBeNull();
    expect(getPlanTemplate("constructor")).toBeNull();
    expect(getPlanTemplate("__proto__")).toBeNull();
  });
});
