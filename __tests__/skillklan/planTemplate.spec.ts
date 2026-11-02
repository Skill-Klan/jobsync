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
  it("is the only track so far", () => {
    expect(PLAN_TRACKS).toEqual(["java"]);
    expect(java.track).toBe("java");
    expect(java.title).toBe("Java");
  });

  it("has the eight modules of the sheet, without the 📱 emoji", () => {
    expect(java.children.map((m) => m.title.split(/[.:]/)[0])).toEqual([
      "Модуль 1", "Модуль 2", "Модуль 3", "Модуль 4", "Модуль 5", "Модуль 6", "Модуль 8", "Модуль 9",
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
    expect(getPlanTemplate("python")).toBeNull();
    expect(getPlanTemplate("constructor")).toBeNull();
    expect(getPlanTemplate("__proto__")).toBeNull();
  });
});
