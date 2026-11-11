#!/usr/bin/env node
// Процес розробки SkillKlan — тонкий шар у репозиторії (джерело — база знань,
// `_meta/sdlc/repo-layer/`; правити там, а не в репозиторії). Версія 2.
//
// У Jira розробки (проєкт SKD) — лише задачі з Telegram-бота (фіча, фікс, покращення).
// Перед розробкою Claude обовʼязково перевіряє Jira: чи немає вже задачі на цю роботу.
// Є — працює з нею (статус, коментар, ключ у комітах). Немає — у Jira нічого не створює.
//   start   SessionStart  — нагадує процес і що налаштувати;
//   first   PreToolUse    — першу правку файлу репозиторію не пропускає без перевірки Jira;
//   touched PostToolUse   — запамʼятовує правлені файли цього репозиторію;
//   jira    PostToolUse   — пошук/читання на сайті розробки → перевірка; запис → ключ задачі;
//   commit  PreToolUse    — сесія працює з задачею → `git commit` без її ключа → відмова;
//   stop    Stop          — код правився, а Jira не перевірено → не завершувати.
// Jira недоступна — людина погоджує пропуск на сьогодні: дата (РРРР-ММ-ДД) у
// `~/.claude/sk-sdlc/jira-unavailable`.
// Якщо на рівні користувача вже стоїть повний контур (гейт бази знань + Jira), хук
// нічого не робить: подвійних перевірок немає.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_CLOUD_ID = "4892f50a-33f4-4893-8943-9ac212cb7b5c";
// Хост сайту розробки — хешем: репозиторії бувають публічні.
export const DEV_HOST_SHA256 = "bae0cbda094bc397dededa2e2c7bd7a6f57c8c3be39e0168acbc6d0dc6c1a1ea";
export const PROJECT_KEY = "SKD";
const KEY_RE = new RegExp(`\\b${PROJECT_KEY}-\\d+\\b`, "g");
const WRITE_TOOLS = /__(createJiraIssue|editJiraIssue|transitionJiraIssue|addCommentToJiraIssue|addOrEditJiraIssueComment)$/;
const CHECK_TOOLS = /__(searchJiraIssuesUsingJql|getJiraIssue|search)$/;

const home = () => process.env.HOME || os.homedir();
const stateDir = () => path.join(home(), ".claude", "sk-sdlc");
const today = () => new Date().toLocaleDateString("sv-SE");

/** Повний контур стоїть на рівні користувача — тоді тонкий шар мовчить. */
export function fullContourInstalled() {
  for (const f of ["settings.json", "settings.local.json"]) {
    try {
      if (fs.readFileSync(path.join(home(), ".claude", f), "utf8").includes("_meta/sdlc/hooks/gate.mjs")) return true;
    } catch {}
  }
  return false;
}

export function isDevSite(cloudId) {
  if (!cloudId) return false;
  const v = String(cloudId).trim().toLowerCase();
  if (v === DEV_CLOUD_ID) return true;
  const host = v.replace(/^https?:\/\//, "").split("/")[0];
  return crypto.createHash("sha256").update(host).digest("hex") === DEV_HOST_SHA256;
}

export function touchedKeys(input) {
  const m = WRITE_TOOLS.exec(String(input.tool_name ?? ""));
  if (!m) return [];
  const ti = input.tool_input ?? {};
  if (!isDevSite(ti.cloudId)) return [];
  if (m[1] === "createJiraIssue") {
    const resp = typeof input.tool_response === "string" ? input.tool_response : JSON.stringify(input.tool_response ?? "");
    const parent = String(ti.parent ?? "").toUpperCase();
    const key = (resp.match(KEY_RE) ?? []).find((k) => k !== parent);
    return key ? [key] : [];
  }
  return [...new Set(String(ti.issueIdOrKey ?? "").match(KEY_RE) ?? [])];
}

export function isCheck(input) {
  return CHECK_TOOLS.test(String(input.tool_name ?? "")) && isDevSite(input.tool_input?.cloudId);
}

function lines(f) {
  try {
    return fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function append(f, line) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, line + "\n");
}

/** Стан сесії: ключі задач, з якими працює, і чи була перевірка Jira (або погоджений пропуск). */
export function session(sid) {
  const ls = sid ? lines(path.join(stateDir(), `${sid}.jira`)) : [];
  const keys = [...new Set(ls.map((l) => l.split("\t")[0]).filter((k) => new RegExp(`^${PROJECT_KEY}-\\d+$`).test(k)))];
  const unavailable = lines(path.join(stateDir(), "jira-unavailable")).some((l) => l.trim() === today());
  return { keys, checked: keys.length > 0 || ls.some((l) => l.startsWith("CHECK\t")), unavailable };
}

const GIT_COMMIT = /(?:^|[\s;&|(`])git((?:\s+(?:-C\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+)|-c\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+)|--?[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s;&|]+))?))*)\s+commit(?![\w-])([^;&|\n]*)/g;

/** null — пропустити; рядок — причина відмови. `keys` — задачі SKD, з якими працює сесія. */
export function checkCommit(command, keys = []) {
  if (!keys.length) return null;
  const cmd = String(command ?? "");
  for (const m of cmd.matchAll(GIT_COMMIT)) {
    if (/(^|\s)--no-edit(\s|$)/.test(m[2] ?? "")) continue;
    if (keys.some((k) => new RegExp(`\\b${k}\\b`).test(cmd))) continue;
    return `Сесія працює із задачею Jira розробки ${keys.join(", ")} — додай ключ у повідомлення коміту: «${keys[0]}: що зроблено».`;
  }
  return null;
}

export function setupText(project) {
  return [
    "Налаштування (один раз на компʼютер):",
    "  1) Конектор Atlassian: `getAccessibleAtlassianResources` має показати сайт Jira розробки",
    `     (cloudId ${DEV_CLOUD_ID}). Немає інструментів Atlassian чи сайту — допоможи людині:`,
    "     `claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp`,",
    "     потім `/mcp` → atlassian → Authenticate, вхід акаунтом, запрошеним у Jira розробки.",
    "     Сайту немає в списку — запрошення не прийняте або інший акаунт: до власника.",
    "  2) База знань SkillKlan — приватний репозиторій; доступ дає власник. Повний контур",
    "     (журнал бази + Jira) ставиться з бази, інструкція — `_meta/sdlc/ПРОЦЕС.md` у ній.",
    `Задачі з бота для цього репозиторію мають мітку proj-${project}.`,
  ].join("\n");
}

export function checkText(project) {
  return [
    `Перед розробкою перевір Jira розробки: чи немає вже задачі на цю роботу.`,
    `  · searchJiraIssuesUsingJql (cloudId ${DEV_CLOUD_ID}): project = ${PROJECT_KEY} AND statusCategory != Done`,
    `    AND text ~ "<ключові слова>" (задачі з бота мають мітку proj-${project}).`,
    `  · Є задача — працюй із нею: статус in development, ключ у комітах, наприкінці коментар`,
    `    (Зроблено / Коміти / Як перевірено / Відкрите) і статус (Done — лише коли зміна в main і перевірена).`,
    `  · Немає — у Jira нічого не створюй: задачі там лише з Telegram-бота.`,
    `  · Jira недоступна — спитай людину; з її згоди запиши сьогоднішню дату в ~/.claude/sk-sdlc/jira-unavailable.`,
  ].join("\n");
}

export function stopVerdict(input, project) {
  if (input.stop_hook_active === true || input.stop_hook_active === "true") return { code: 0 };
  const sid = input.session_id;
  if (!sid) return { code: 0 };
  const files = lines(path.join(stateDir(), `${sid}.files`));
  if (!files.length) return { code: 0 };
  const s = session(sid);
  if (s.checked || s.unavailable) return { code: 0 };
  const msg = [`🛑 Процес розробки SkillKlan: код правився (${files.length} файл.), а Jira розробки за сесію не перевірено.`, checkText(project), "", setupText(project)].join("\n");
  return { code: 2, message: msg + "\n" };
}

/** PreToolUse Edit/Write: null — пропустити; рядок — причина відмови. */
export function firstVerdict(input, projectDir, project) {
  const fp = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!fp) return null;
  const rel = path.relative(projectDir, fp);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const s = session(input.session_id);
  if (s.checked || s.unavailable) return null;
  return `${checkText(project)}\n${setupText(project)}`;
}

async function readStdin() {
  let s = "";
  for await (const c of process.stdin) s += c;
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function isMain() {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] ?? "");
  } catch {
    return false;
  }
}

const deny = (reason) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));

if (isMain()) {
  const [sub, project = "<проєкт>"] = process.argv.slice(2);
  const input = await readStdin();
  if (fullContourInstalled()) process.exit(0);
  const sid = input.session_id;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  if (sub === "start") {
    const ctx = [
      "## Процес розробки SkillKlan — перед розробкою перевірити Jira розробки",
      `У Jira (проєкт ${PROJECT_KEY}) — лише задачі з Telegram-бота. Є задача на цю роботу — працюй із нею; немає — нічого не створюй.`,
      "Деталі — розділ «Процес розробки SkillKlan» у CLAUDE.md репозиторію.",
      "",
      checkText(project),
      "",
      setupText(project),
    ].join("\n");
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
  } else if (sub === "first") {
    const reason = firstVerdict(input, projectDir, project);
    if (reason) deny(reason);
  } else if (sub === "touched" && sid) {
    const fp = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const rel = fp ? path.relative(projectDir, fp) : "..";
    if (fp && !rel.startsWith("..") && !path.isAbsolute(rel)) append(path.join(stateDir(), `${sid}.files`), fp);
  } else if (sub === "jira" && sid) {
    const ts = new Date().toISOString();
    for (const k of touchedKeys(input)) append(path.join(stateDir(), `${sid}.jira`), `${k}\t${ts}`);
    if (isCheck(input)) append(path.join(stateDir(), `${sid}.jira`), `CHECK\t${ts}`);
  } else if (sub === "commit" && input.tool_name === "Bash") {
    const reason = checkCommit(input.tool_input?.command, session(sid).keys);
    if (reason) deny(reason);
  } else if (sub === "stop") {
    const r = stopVerdict(input, project);
    if (r.message) process.stderr.write(r.message);
    process.exit(r.code);
  }
  process.exit(0);
}
