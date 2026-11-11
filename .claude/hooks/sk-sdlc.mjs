#!/usr/bin/env node
// Процес розробки SkillKlan — тонкий шар у репозиторії (джерело — база знань,
// `_meta/sdlc/repo-layer/`; правити там, а не в репозиторії).
//
// Кожна зміна коду з Claude Code має задачу в Jira розробки (проєкт SKD) з коментарем
// і статусом. Цей хук тримає це правило на машинах, де повного контуру ще немає:
//   start   SessionStart  — нагадує процес і що налаштувати;
//   touched PostToolUse   — запамʼятовує правлені файли цього репозиторію;
//   jira    PostToolUse   — запамʼятовує задачі SKD, у які писали (лише сайт розробки);
//   commit  PreToolUse    — `git commit` без ключа SKD-n → відмова;
//   stop    Stop          — код правився, а запису в Jira немає → не завершувати.
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

const home = () => process.env.HOME || os.homedir();
const stateDir = () => path.join(home(), ".claude", "sk-sdlc");

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

const GIT_COMMIT = /(?:^|[\s;&|(`])git((?:\s+(?:-C\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+)|-c\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+)|--?[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s;&|]+))?))*)\s+commit(?![\w-])([^;&|\n]*)/g;

/** null — пропустити; рядок — причина відмови. */
export function checkCommit(command) {
  const cmd = String(command ?? "");
  for (const m of cmd.matchAll(GIT_COMMIT)) {
    if (/(^|\s)--no-edit(\s|$)/.test(m[2] ?? "")) continue;
    if (new RegExp(KEY_RE.source).test(cmd)) continue;
    return `Коміт без ключа задачі Jira розробки. Додай ключ у повідомлення: «${PROJECT_KEY}-12: що зроблено». Задачі немає — знайди або створи її в ${PROJECT_KEY} (розділ «Процес розробки SkillKlan» у CLAUDE.md).`;
  }
  return null;
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
    `Мітка проєкту в Jira: proj-${project}.`,
  ].join("\n");
}

export function stopVerdict(input, project) {
  if (input.stop_hook_active === true || input.stop_hook_active === "true") return { code: 0 };
  const sid = input.session_id;
  if (!sid) return { code: 0 };
  const files = lines(path.join(stateDir(), `${sid}.files`));
  if (!files.length) return { code: 0 };
  const keys = lines(path.join(stateDir(), `${sid}.jira`)).map((l) => l.split("\t")[0]);
  if (keys.length) return { code: 0 };
  const msg = [
    `🛑 Процес розробки SkillKlan: код правився (${files.length} файл.), а запису в Jira розробки за сесію немає.`,
    `  · Знайди задачу ${PROJECT_KEY} (JQL: project = ${PROJECT_KEY} AND labels = proj-${project} AND statusCategory != Done)`,
    `    або створи Task під епіком «${project} — поточні роботи» (мітки proj-${project}, claude-session).`,
    "  · Коментар: Зроблено / Коміти / Як перевірено / Відкрите (+ «Для бази знань:», якщо бази ще немає).",
    "  · Статус: Done — лише коли зміна в main і перевірена; інакше in development / review.",
    "",
    setupText(project),
  ].join("\n");
  return { code: 2, message: msg + "\n" };
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

if (isMain()) {
  const [sub, project = "<проєкт>"] = process.argv.slice(2);
  const input = await readStdin();
  if (fullContourInstalled()) process.exit(0);
  const sid = input.session_id;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  if (sub === "start") {
    const ctx = [
      "## Процес розробки SkillKlan — Jira розробки обовʼязкова",
      `Кожна зміна коду має задачу ${PROJECT_KEY} з коментарем і статусом; коміти — з ключем \`${PROJECT_KEY}-12: …\`.`,
      "Деталі — розділ «Процес розробки SkillKlan» у CLAUDE.md репозиторію.",
      "",
      setupText(project),
    ].join("\n");
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
  } else if (sub === "touched" && sid) {
    const fp = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const rel = fp ? path.relative(projectDir, fp) : "..";
    if (fp && !rel.startsWith("..") && !path.isAbsolute(rel)) append(path.join(stateDir(), `${sid}.files`), fp);
  } else if (sub === "jira" && sid) {
    for (const k of touchedKeys(input)) append(path.join(stateDir(), `${sid}.jira`), `${k}\t${new Date().toISOString()}`);
  } else if (sub === "commit" && input.tool_name === "Bash") {
    const reason = checkCommit(input.tool_input?.command);
    if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  } else if (sub === "stop") {
    const r = stopVerdict(input, project);
    if (r.message) process.stderr.write(r.message);
    process.exit(r.code);
  }
  process.exit(0);
}
