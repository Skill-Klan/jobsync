// Requirement — D29 (Ukrainian by default, English on request) and D30 (the
// owner's glossary): form validation messages speak the language of the page.
// Both kinds: the messages our schemas carry (src/models) and the ones zod
// writes itself for a field that has none. The language is read from
// <html lang> when a value is checked, not when the schema module loads, so a
// language switch applies without a reload. English keeps the old text.
//
// Every expected text below is written out by hand, numbers included: it comes
// from the requirement (the glossary, Ukrainian grammar, the old English), not
// from the dictionary or APP_CONSTANTS.
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { AddTaskFormSchema } from "@/models/addTaskForm.schema";
import { AddQuestionFormSchema } from "@/models/addQuestionForm.schema";
import { AddContactFormSchema } from "@/models/addContactForm.schema";
import { AddActivityFormSchema } from "@/models/addActivityForm.schema";
import { SigninFormSchema } from "@/models/signinForm.schema";
import { CreateAutomationSchema } from "@/models/automation.schema";
import { AddJobStageFormSchema } from "@/models/jobStage.model";
import { TaskForm } from "@/components/tasks/TaskForm";
import enValidation from "@/i18n/messages/en/validation.json";
import ukValidation from "@/i18n/messages/uk/validation.json";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/task.actions", () => ({ createTask: vi.fn(), updateTask: vi.fn() }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

// Compile time: a key outside the dictionary does not build (npx tsc). The
// import is type-only, so it costs nothing at run time.
type Vt = typeof import("@/i18n/validation").vt;
function vtKeysAreChecked(vt: Vt) {
  vt("fields.jobTitle.required");
  vt("fields.jobTitle.min", { min: 2 });
  // @ts-expect-error — not a key of the validation dictionary
  vt("fields.jobTitle.nope");
}
void vtKeysAreChecked;

// Ukrainian writes thousands with a non-breaking space: «2 000».
const NBSP = " ";

const setLang = (lang: string) => {
  document.documentElement.lang = lang;
};

afterEach(() => setLang(""));

/** [path, message] of every issue of a rejected value. */
function issuesOf(schema: z.ZodType, value: unknown): [string, string][] {
  const result = schema.safeParse(value);
  if (result.success) throw new Error("expected the value to be rejected");
  return result.error.issues.map((issue) => [issue.path.join("."), issue.message]);
}

/** The messages of one field. */
function messagesFor(schema: z.ZodType, value: unknown, field: string): string[] {
  return issuesOf(schema, value)
    .filter(([p]) => p === field)
    .map(([, message]) => message);
}

const job = {
  title: "QA Engineer",
  company: "SoftServe",
  location: "Kyiv",
  type: "FT",
  source: "LinkedIn",
  status: "draft",
  dueDate: new Date(2030, 0, 1),
  jobDescription: "Testing web applications end to end",
};

const task = { title: "Оновити резюме", status: "in-progress", priority: 5, percentComplete: 0 };

const automation = {
  name: "QA у Києві",
  jobBoard: "greenhouse",
  resumeId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  matchThreshold: 70,
  scheduleHour: 9,
  sourceConfig: { greenhouse: { companies: [] } },
};

describe("schema messages in Ukrainian", () => {
  beforeEach(() => setLang("uk"));

  it("job form", () => {
    expect(messagesFor(AddJobFormSchema, { ...job, title: undefined }, "title")).toEqual(["Вкажіть назву посади."]);
    expect(messagesFor(AddJobFormSchema, { ...job, title: "Q" }, "title")).toEqual([
      "Назва посади — щонайменше 2 символи.",
    ]);
    expect(messagesFor(AddJobFormSchema, { ...job, company: "S" }, "company")).toEqual([
      "Назва компанії — щонайменше 2 символи.",
    ]);
    expect(messagesFor(AddJobFormSchema, { ...job, location: undefined }, "location")).toEqual(["Вкажіть локацію."]);
    expect(messagesFor(AddJobFormSchema, { ...job, source: "L" }, "source")).toEqual([
      "Назва джерела — щонайменше 2 символи.",
    ]);
    expect(messagesFor(AddJobFormSchema, { ...job, jobDescription: "Коротко" }, "jobDescription")).toEqual([
      "Опис — щонайменше 10 символів.",
    ]);
  });

  it("task form", () => {
    expect(messagesFor(AddTaskFormSchema, { ...task, title: undefined }, "title")).toEqual(["Вкажіть назву завдання."]);
    expect(messagesFor(AddTaskFormSchema, { ...task, title: "О" }, "title")).toEqual([
      "Назва завдання — щонайменше 2 символи.",
    ]);
    expect(messagesFor(AddTaskFormSchema, { ...task, description: "а".repeat(2001) }, "description")).toEqual([
      `Опис — не більше 2${NBSP}000 символів.`,
    ]);
    expect(messagesFor(AddTaskFormSchema, { ...task, dueDate: new Date(2000, 0, 1) }, "dueDate")).toEqual([
      "Термін не може бути в минулому.",
    ]);
  });

  it("question form: the number takes its plural form", () => {
    const q = { question: "Що таке регресійне тестування?", answer: "Перевірка, що старе не зламалось." };
    expect(messagesFor(AddQuestionFormSchema, { answer: q.answer }, "question")).toEqual(["Напишіть питання."]);
    expect(messagesFor(AddQuestionFormSchema, { ...q, question: "Що?" }, "question")).toEqual([
      "Питання — щонайменше 5 символів.",
    ]);
    expect(messagesFor(AddQuestionFormSchema, { ...q, question: "а".repeat(501) }, "question")).toEqual([
      "Питання — не більше 500 символів.",
    ]);
    expect(messagesFor(AddQuestionFormSchema, { ...q, answer: "Коротко" }, "answer")).toEqual([
      "Відповідь — щонайменше 10 символів.",
    ]);
    expect(messagesFor(AddQuestionFormSchema, { ...q, answer: "а".repeat(5001) }, "answer")).toEqual([
      `Відповідь — не більше 5${NBSP}000 символів.`,
    ]);
    const tagIds = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    expect(messagesFor(AddQuestionFormSchema, { ...q, tagIds }, "tagIds")).toEqual(["Не більше 10 навичок."]);
  });

  it("contact form: a refinement lands on its field", () => {
    const contact = { name: "Олена Коваль" };
    expect(
      issuesOf(AddContactFormSchema, { ...contact, workedFrom: new Date(2021, 0, 1), workedTo: new Date(2019, 0, 1) }),
    ).toEqual([["workedTo", "Дата завершення не може бути раніше за дату початку."]]);
    expect(messagesFor(AddContactFormSchema, { name: "" }, "name")).toEqual(["Імʼя контакту не може бути порожнім."]);
    expect(messagesFor(AddContactFormSchema, { name: "а".repeat(121) }, "name")).toEqual([
      "Імʼя контакту — не більше 120 символів.",
    ]);
    expect(messagesFor(AddContactFormSchema, { ...contact, email: "olena@" }, "email")).toEqual([
      "Вкажіть правильну електронну пошту.",
    ]);
    expect(messagesFor(AddContactFormSchema, { ...contact, linkedinUrl: "linkedin.com/in/olena" }, "linkedinUrl")).toEqual([
      "Вкажіть повне посилання на профіль LinkedIn, що починається з https://",
    ]);
    expect(messagesFor(AddContactFormSchema, { ...contact, lastContactedAt: new Date(2100, 0, 1) }, "lastContactedAt")).toEqual([
      "Дата останнього контакту не може бути в майбутньому.",
    ]);
  });

  it("activity form: field rules and every cross-field refinement", () => {
    const day = new Date(2020, 0, 10);
    const activity = { activityName: "Пошук вакансій", activityType: "research", startDate: day, startTime: "09:00 AM" };
    expect(messagesFor(AddActivityFormSchema, { ...activity, activityName: "П" }, "activityName")).toEqual([
      "Назва активності — щонайменше 2 символи.",
    ]);
    expect(messagesFor(AddActivityFormSchema, { ...activity, activityType: "" }, "activityType")).toEqual([
      "Оберіть тип активності.",
    ]);
    expect(messagesFor(AddActivityFormSchema, { ...activity, startTime: "9am" }, "startTime")).toContain(
      "Вкажіть правильний час початку",
    );
    expect(issuesOf(AddActivityFormSchema, { ...activity, endDate: new Date(2020, 0, 9) })).toEqual([
      ["endDate", "Дата завершення не може бути раніше за дату початку"],
    ]);
    expect(messagesFor(AddActivityFormSchema, { ...activity, endDate: day, endTime: "08:00 AM" }, "endTime")).toContain(
      "Час завершення має бути пізніше за час початку",
    );
    expect(issuesOf(AddActivityFormSchema, { ...activity, endDate: day, endTime: "09:01 AM" })).toEqual([
      ["endTime", "Активність має тривати щонайменше 2 хвилини"],
    ]);
    expect(issuesOf(AddActivityFormSchema, { ...activity, endDate: day, endTime: "06:00 PM" })).toEqual([
      ["endTime", "Активність не може тривати довше за 8 годин"],
    ]);
    expect(issuesOf(AddActivityFormSchema, { ...activity, startDate: new Date(2100, 0, 1) })).toEqual([
      ["startTime", "Початок не може бути в майбутньому"],
    ]);
  });

  it("sign-in form, including a field left to zod's own message", () => {
    expect(issuesOf(SigninFormSchema, {})).toEqual([
      ["email", "Вкажіть електронну пошту."],
      ["password", "Введіть пароль."],
    ]);
    expect(issuesOf(SigninFormSchema, { email: "ab", password: "" })).toEqual([
      ["email", "Електронна пошта — щонайменше 3 символи."],
      ["email", "Вкажіть правильну електронну пошту."],
      ["password", "Заповніть це поле"],
    ]);
  });

  it("automation: a superRefine message, and field messages", () => {
    expect(issuesOf(CreateAutomationSchema, automation)).toEqual([
      ["sourceConfig.greenhouse.companies", "Оберіть хоча б одну компанію"],
    ]);
    expect(messagesFor(CreateAutomationSchema, { ...automation, name: "" }, "name")).toEqual(["Вкажіть назву автопошуку"]);
    expect(messagesFor(CreateAutomationSchema, { ...automation, resumeId: "" }, "resumeId")).toEqual(["Оберіть резюме"]);
  });

  it("stage dialog: pick a stage, or name one and give it a status", () => {
    expect(issuesOf(AddJobStageFormSchema, { jobId: "job-1" })).toEqual([
      ["stageTypeId", "Оберіть етап або вкажіть назву свого."],
    ]);
    expect(issuesOf(AddJobStageFormSchema, { jobId: "job-1", customLabel: "Тестове завдання" })).toEqual([
      ["customStatusId", "Оберіть статус, якому відповідає цей етап."],
    ]);
  });
});

describe("the language is read when a value is checked, not when the schema loads", () => {
  it("the same schema object answers in English, then Ukrainian, then English again", () => {
    const value = { ...job, title: undefined, type: "" };
    setLang("en");
    expect(messagesFor(AddJobFormSchema, value, "title")).toEqual(["Job title is required."]);
    expect(messagesFor(AddJobFormSchema, value, "type")).toEqual(["Fill in this field"]);
    setLang("uk");
    expect(messagesFor(AddJobFormSchema, value, "title")).toEqual(["Вкажіть назву посади."]);
    expect(messagesFor(AddJobFormSchema, value, "type")).toEqual(["Заповніть це поле"]);
    setLang("en");
    expect(messagesFor(AddJobFormSchema, value, "title")).toEqual(["Job title is required."]);
  });

  it("refine and superRefine messages too", () => {
    const overlap = { name: "Олена", workedFrom: new Date(2021, 0, 1), workedTo: new Date(2019, 0, 1) };
    setLang("en");
    expect(messagesFor(AddContactFormSchema, overlap, "workedTo")).toEqual(["The end date cannot be before the start date."]);
    expect(issuesOf(CreateAutomationSchema, automation)).toEqual([
      ["sourceConfig.greenhouse.companies", "Select at least one company"],
    ]);
    setLang("uk");
    expect(messagesFor(AddContactFormSchema, overlap, "workedTo")).toEqual([
      "Дата завершення не може бути раніше за дату початку.",
    ]);
    expect(issuesOf(CreateAutomationSchema, automation)).toEqual([
      ["sourceConfig.greenhouse.companies", "Оберіть хоча б одну компанію"],
    ]);
  });

  it("a page without a language, or with another one, gets English", () => {
    for (const lang of ["", "de", "uk-UA"]) {
      setLang(lang);
      expect(messagesFor(AddJobFormSchema, { ...job, title: "Q" }, "title")).toEqual([
        "Job title must be at least 2 characters.",
      ]);
    }
  });
});

describe("zod's own messages, for fields without one of ours", () => {
  it("in Ukrainian", () => {
    setLang("uk");
    expect(messagesFor(AddJobFormSchema, { ...job, type: "" }, "type")).toEqual(["Заповніть це поле"]);
    expect(messagesFor(AddJobFormSchema, { ...job, dueDate: undefined }, "dueDate")).toEqual(["Заповніть це поле"]);
    expect(messagesFor(AddJobFormSchema, { ...job, dueDate: "next friday" }, "dueDate")).toEqual(["Неправильне значення"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, status: "someday" }, "status")).toEqual(["Оберіть один із варіантів"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, priority: 11 }, "priority")).toEqual(["Не більше 10"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, percentComplete: -1 }, "percentComplete")).toEqual(["Щонайменше 0"]);
    expect(messagesFor(AddJobStageFormSchema, { jobId: "job-1", stageTypeId: "t", durationMins: 0 }, "durationMins")).toEqual([
      "Більше за 0",
    ]);
    expect(issuesOf(z.object({ email: z.email() }), { email: "olena@" })).toEqual([
      ["email", "Вкажіть правильну електронну пошту"],
    ]);
    expect(issuesOf(z.object({ link: z.url() }), { link: "not a link" })).toEqual([["link", "Вкажіть правильне посилання"]]);
    expect(issuesOf(z.object({ code: z.string().regex(/^\d+$/) }), { code: "abc" })).toEqual([
      ["code", "Неправильний формат"],
    ]);
  });

  it("string lengths in Ukrainian take the plural form of the number", () => {
    setLang("uk");
    const min = (n: number) => issuesOf(z.string().min(n), "")[0][1];
    const max = (n: number) => issuesOf(z.string().max(n), "а".repeat(n + 1))[0][1];
    expect(min(21)).toBe("Щонайменше 21 символ");
    expect(min(3)).toBe("Щонайменше 3 символи");
    expect(min(5)).toBe("Щонайменше 5 символів");
    expect(max(21)).toBe("Не більше 21 символу");
    expect(max(3)).toBe("Не більше 3 символів");
    expect(max(100)).toBe("Не більше 100 символів");
  });

  it("in English: our plain texts, not zod's", () => {
    setLang("en");
    expect(messagesFor(AddJobFormSchema, { ...job, type: "" }, "type")).toEqual(["Fill in this field"]);
    expect(messagesFor(AddJobFormSchema, { ...job, dueDate: "next friday" }, "dueDate")).toEqual(["Invalid value"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, status: "someday" }, "status")).toEqual(["Choose one of the options"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, priority: 11 }, "priority")).toEqual(["At most 10"]);
    expect(messagesFor(AddTaskFormSchema, { ...task, percentComplete: -1 }, "percentComplete")).toEqual(["At least 0"]);
    expect(messagesFor(AddJobStageFormSchema, { jobId: "job-1", stageTypeId: "t", durationMins: 0 }, "durationMins")).toEqual([
      "More than 0",
    ]);
    expect(issuesOf(z.object({ email: z.email() }), { email: "olena@" })).toEqual([["email", "Enter a valid email"]]);
    expect(issuesOf(z.object({ link: z.url() }), { link: "not a link" })).toEqual([["link", "Enter a valid link"]]);
    expect(issuesOf(z.object({ code: z.string().regex(/^\d+$/) }), { code: "abc" })).toEqual([["code", "Invalid format"]]);
    expect(issuesOf(z.string().min(21), "")[0][1]).toBe("At least 21 characters");
    expect(issuesOf(z.string().max(21), "a".repeat(22))[0][1]).toBe("At most 21 characters");
  });
});

describe("a form shows the message under its field", () => {
  it("add-task dialog, submitted empty, in Ukrainian", async () => {
    const user = userEvent.setup({ skipHover: true });
    setTestLocale("uk");
    setLang("uk");
    render(
      <TaskForm
        activityTypes={[]}
        resetEditTask={vi.fn()}
        onTaskSaved={vi.fn()}
        dialogOpen
        setDialogOpen={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("save-task-btn"));
    expect(await screen.findByText("Назва завдання — щонайменше 2 символи.")).toBeInTheDocument();
    expect(screen.queryByText(/at least|characters/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Guard: no English literal message is left in src/models. The patterns are
// built from parts so this file never matches its own search.
// ---------------------------------------------------------------------------

const ERR = ["err", "or"].join("");
const MSG = ["mess", "age"].join("");
const LITERAL_KEY = new RegExp(`\\b(?:${ERR}|${MSG})\\s*:\\s*["'\`]`);
// zod methods whose string argument is the error message
const MESSAGE_TAKERS = [
  "string", "number", "date", "boolean", "bigint", "enum", "array",
  "min", "max", "length", "nonempty", "int", "positive", "nonnegative", "negative", "nonpositive",
  "gt", "gte", "lt", "lte", "multipleOf", "email", "url", "uuid", "datetime", "regex", "refine",
];
const CALL = new RegExp(`\\.(?:${MESSAGE_TAKERS.join("|")})\\(`, "g");
const REGEX_MAY_FOLLOW = "(,=:[!&|?{};";

/** Index just past a regex literal starting at `i` (src[i] === "/"). */
function skipRegex(src: string, i: number): number {
  let j = i + 1;
  let inClass = false;
  while (j < src.length && src[j] !== "\n") {
    const c = src[j];
    if (c === "\\") j += 2;
    else {
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) return j + 1;
      j++;
    }
  }
  return j;
}

/** Code with comments removed; strings and regex literals kept as they are. */
function stripComments(src: string): string {
  let out = "";
  let prev = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      prev = c;
      i = j + 1;
    } else if (c === "/" && (prev === "" || REGEX_MAY_FOLLOW.includes(prev))) {
      const end = skipRegex(src, i);
      out += src.slice(i, end);
      prev = "/";
      i = end;
    } else {
      out += c;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return out;
}

/** Top-level arguments of the call whose "(" ends just before `start`. */
function callArgs(src: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let prev = "(";
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      current += src.slice(i, j + 1);
      prev = c;
      i = j + 1;
      continue;
    }
    if (c === "/" && REGEX_MAY_FOLLOW.includes(prev)) {
      const end = skipRegex(src, i);
      current += src.slice(i, end);
      prev = "/";
      i = end;
      continue;
    }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) {
      if (depth === 0) break;
      depth--;
    }
    if (c === "," && depth === 0) {
      args.push(current);
      current = "";
    } else current += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  if (current.trim()) args.push(current);
  return args;
}

function literalKeyOffences(code: string): string[] {
  return code.split("\n").filter((line) => LITERAL_KEY.test(line)).map((line) => line.trim());
}

function positionalOffences(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(CALL)) {
    const args = callArgs(code, match.index + match[0].length);
    if (args.some((arg) => /^["'`]/.test(arg.trim()))) found.push(`${match[0]}${args.join(",").trim()})`);
  }
  return found;
}

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTs(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const MODELS_DIR = path.join(process.cwd(), "src/models");
const VALIDATION_MODULE = path.join(process.cwd(), "src/i18n/validation.ts");
const readValidationModule = () =>
  fs.existsSync(VALIDATION_MODULE) ? stripComments(fs.readFileSync(VALIDATION_MODULE, "utf8")) : "";
const models = new Map(
  listTs(MODELS_DIR).map((file) => [path.relative(MODELS_DIR, file), stripComments(fs.readFileSync(file, "utf8"))]),
);

function leafKeys(tree: unknown, prefix = ""): string[] {
  if (typeof tree === "string") return [prefix];
  if (!tree || typeof tree !== "object") return [];
  return Object.entries(tree).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key));
}

function lookup(tree: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (node, part) =>
      node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, part)
        ? (node as Record<string, unknown>)[part]
        : undefined,
    tree,
  );
}

describe("guard: no English literal message is left in src/models", () => {
  it("the scan reads the schema files", () => {
    expect(models.size).toBeGreaterThan(20);
    expect(models.get("addJobForm.schema.ts")).toContain("AddJobFormSchema");
    expect(models.get("signinForm.schema.ts")).toContain("SigninFormSchema");
  });

  it("the detectors catch a literal and leave a lazy message alone", () => {
    const flagged = [
      `z.string({ ${ERR}: "Name is required." })`,
      `z.string().min(2, { ${MSG}: \`At least \${n} characters.\` })`,
      `ctx.addIssue({ code: "custom", ${MSG}: 'Pick one' })`,
    ];
    for (const sample of flagged) expect(literalKeyOffences(stripComments(sample))).toHaveLength(1);

    const flaggedByPosition = [
      `z.string().min(1, "API key is required")`,
      `z.string().regex(/^(a|b)$/, "Must be a or b")`,
      String.raw`z.string().optional().refine((v) => !v || /^https?:\/\//i.test(v), "URL must start with http")`,
      `z.string().email("Please enter a valid email.")`,
      `z.string().default("https://x.io").uuid('Invalid resume')`,
    ];
    for (const sample of flaggedByPosition) expect(positionalOffences(stripComments(sample))).toHaveLength(1);

    const clean = [
      `z.string({ ${ERR}: () => vt("fields.jobTitle.required") }).min(2, { ${ERR}: () => vt("fields.jobTitle.min", { min: 2 }) })`,
      `ctx.addIssue({ code: "custom", path: ["a"], ${MSG}: vt("automations.companies.min") })`,
      `// z.string({ ${ERR}: "a comment is not code" }).min(1, "nor is this")`,
      `/* ${MSG}: "nor this" */ z.string()`,
      `z.string().describe("What the job involves, e.g. 'Remote'").default("")`,
      `z.string().refine((url) => !url || url.startsWith("/"), { ${ERR}: () => vt("company.logoUrl.invalid") })`,
      `z.enum(["a", "b"]).or(z.literal(""))`,
    ];
    for (const sample of clean) {
      const code = stripComments(sample);
      expect([...literalKeyOffences(code), ...positionalOffences(code)]).toEqual([]);
    }
  });

  it("no error/message key holds a string or template literal", () => {
    const offences = [...models].flatMap(([file, code]) => literalKeyOffences(code).map((line) => `${file}: ${line}`));
    expect(offences).toEqual([]);
  });

  it("no message is passed to zod as a literal argument", () => {
    const offences = [...models].flatMap(([file, code]) => positionalOffences(code).map((call) => `${file}: ${call}`));
    expect(offences).toEqual([]);
  });

  it("every key the schemas ask for exists in both languages", () => {
    const sources = [...models.values(), readValidationModule()].join("\n");
    const asked = [...sources.matchAll(/\bvt\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(50);
    const missing = asked.filter((key) => typeof lookup(enValidation, key) !== "string" || typeof lookup(ukValidation, key) !== "string");
    expect(missing).toEqual([]);
  });

  it("every dictionary key is used somewhere", () => {
    const sources = [...models.values(), readValidationModule()].join("\n");
    const keys = leafKeys(enValidation);
    expect(keys.length).toBeGreaterThan(50);
    const unused = keys.filter((key) => !sources.includes(`"${key}"`));
    expect(unused).toEqual([]);
  });
});
