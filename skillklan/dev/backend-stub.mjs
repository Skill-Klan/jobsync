// A local stand-in for the SkillKlan backend — development and tests only.
//
//   npm run dev:backend      (reads .env.local; http://127.0.0.1:3739, DEV_BACKEND_PORT to change)
//
// Two faces:
//   · the backend's /api/jobsync/* that SkillKlan Job calls (docs/contracts/backend-login.md):
//     POST /api/jobsync/login-code/exchange, GET /api/jobsync/users/:id/access;
//   · a page that plays the cabinet: pick a fake person, get a one-time code, and the page posts it to
//     SkillKlan Job's /auth/cabinet exactly as the cabinet does — so sign-in, roles, an excluded person
//     and the 5-minute access re-check can all be tried locally.
//
// It answers like the backend, refusals included — the backend's own API tests are the reference: an
// unknown, used, expired or malformed code is one and the same 401; an unknown id is `allowed: false`,
// never 404; no secret configured is 503; a wrong secret is 401 and does not spend the code. A stand-in
// that accepts anything would prove nothing. Fake people only, kept in memory; no network calls.

import crypto from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";

export const DEFAULT_PEOPLE = Object.freeze([
  { id: 1001, role: "student", name: "Test Student", active: true },
  { id: 1002, role: "admin", name: "Test Admin", active: true },
  { id: 1003, role: "qa_moderator", name: "Test QA Moderator", active: true },
  { id: 1004, role: "mentor", name: "Test Mentor", active: true },
  { id: 1005, role: "student", name: "Excluded Student", active: false },
]);

// The backend's rule: these roles, an active account. (It also refuses a temporary password; the stand-in
// has no passwords.)
const ROLES_ALLOWED = ["student", "admin", "qa_moderator"];
const CODE_FORMAT = /^[A-Za-z0-9_-]{43}$/;
export const CODE_TTL_MS = 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;

const CODE_INVALID = {
  status: 401,
  body: { error: "Не авторизовано", message: "Код входу недійсний", code: "JOBSYNC_CODE_INVALID" },
};
const ACCESS_DENIED = {
  status: 403,
  body: { error: "Доступ заборонено", message: "Немає доступу до SkillKlan Job", code: "JOBSYNC_ACCESS_DENIED" },
};
const UNAUTHORIZED = { status: 401, body: { error: "unauthorized" } };
const UNAVAILABLE = { status: 503, body: { error: "service_unavailable" } };

const envelope = (data) => ({ status: 200, body: { success: true, data, error: null } });

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

/**
 * @param {{ secret?: string, people?: readonly {id: number, role: string, name: string, active: boolean}[],
 *           jobsUrl?: string, now?: () => number }} [options]
 */
export function createBackendStub({
  secret,
  people = DEFAULT_PEOPLE,
  jobsUrl = "http://localhost:3737",
  now = () => Date.now(),
} = {}) {
  const byId = new Map(people.map((p) => [p.id, { ...p }]));
  /** code → { userId, expiresAt }; one live code per person, as on the backend */
  const codes = new Map();

  const isAllowed = (person) => Boolean(person) && person.active && ROLES_ALLOWED.includes(person.role);

  /** The cabinet's side (POST /api/jobsync/login-code): only someone allowed gets a code. */
  function issueCode(userId) {
    if (!isAllowed(byId.get(userId))) return null;
    for (const [code, entry] of codes) if (entry.userId === userId) codes.delete(code);
    const code = crypto.randomBytes(32).toString("base64url");
    codes.set(code, { userId, expiresAt: now() + CODE_TTL_MS });
    return code;
  }

  function setActive(userId, active) {
    const person = byId.get(userId);
    if (person) person.active = Boolean(active);
  }

  // Secret first, as the backend's middleware runs before the handler: a wrong secret never reaches
  // the code, so it cannot spend it.
  function refuseUnlessSecret(req) {
    if (!secret) return UNAVAILABLE;
    const given = req.headers["x-jobsync-secret"];
    if (typeof given !== "string" || !crypto.timingSafeEqual(sha256(given), sha256(secret))) return UNAUTHORIZED;
    return null;
  }

  function exchange(body) {
    const code = body && typeof body === "object" ? body.code : undefined;
    if (typeof code !== "string" || !CODE_FORMAT.test(code)) return CODE_INVALID;
    const entry = codes.get(code);
    if (!entry || entry.expiresAt <= now()) return CODE_INVALID;
    codes.delete(code);
    // Checked again after the code is spent: the person may have lost access in those 60 seconds.
    const person = byId.get(entry.userId);
    if (!isAllowed(person)) return ACCESS_DENIED;
    return envelope({ userId: person.id, role: person.role, name: person.name });
  }

  function access(rawId) {
    const id = /^[1-9]\d*$/.test(rawId) ? Number(rawId) : null;
    const person = Number.isSafeInteger(id) ? byId.get(id) : undefined;
    return isAllowed(person) ? envelope({ allowed: true, role: person.role }) : envelope({ allowed: false, role: null });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://stub.local");
    try {
      if (url.pathname.startsWith("/api/jobsync/")) {
        const answer = await api(req, url);
        res.writeHead(answer.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(answer.body));
        return;
      }
      if (req.method === "GET" && url.pathname === "/") return sendHtml(res, 200, cabinetPage());
      if (req.method === "POST" && url.pathname === "/cabinet/sign-in") {
        const id = Number(new URLSearchParams(await readBody(req)).get("userId"));
        const code = issueCode(id);
        if (!code) return sendHtml(res, 403, page("No code", "<p>The backend gives no code to this person (403).</p><p><a href='/'>Back</a></p>"));
        return sendHtml(res, 200, postToJobs(code));
      }
      if (req.method === "POST" && url.pathname === "/cabinet/toggle") {
        const id = Number(new URLSearchParams(await readBody(req)).get("userId"));
        const person = byId.get(id);
        if (person) setActive(id, !person.active);
        res.writeHead(303, { location: "/" });
        res.end();
        return;
      }
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
    } catch {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "internal" }));
    }
  });

  async function api(req, url) {
    if (req.method === "POST" && url.pathname === "/api/jobsync/login-code/exchange") {
      const refused = refuseUnlessSecret(req);
      if (refused) return refused;
      let body;
      try {
        body = JSON.parse((await readBody(req)) || "null");
      } catch {
        body = null;
      }
      return exchange(body);
    }
    const match = /^\/api\/jobsync\/users\/([^/]+)\/access$/.exec(url.pathname);
    if (req.method === "GET" && match) {
      const refused = refuseUnlessSecret(req);
      if (refused) return refused;
      return access(decodeURIComponent(match[1]));
    }
    return { status: 404, body: { error: "not_found" } };
  }

  function cabinetPage() {
    const rows = [...byId.values()]
      .map(
        (p) => `<tr><td>${p.id}</td><td>${escapeHtml(p.name)}</td><td>${p.role}</td>
          <td>${p.active ? "active" : "excluded"}</td><td>${isAllowed(p) ? "yes" : "no"}</td>
          <td><form method="post" action="/cabinet/sign-in"><input type="hidden" name="userId" value="${p.id}">
            <button>Open SkillKlan Job</button></form></td>
          <td><form method="post" action="/cabinet/toggle"><input type="hidden" name="userId" value="${p.id}">
            <button>${p.active ? "Exclude" : "Restore"}</button></form></td></tr>`,
      )
      .join("");
    return page(
      "Local cabinet",
      `<p>Fake people. «Open SkillKlan Job» gets a one-time code and posts it to ${escapeHtml(jobsUrl)}/auth/cabinet,
       like the real cabinet. Excluding someone who is signed in ends their session at the next access check
       (at most 5 minutes).</p>
       <table><tr><th>id</th><th>name</th><th>role</th><th>account</th><th>may come in</th><th></th><th></th></tr>${rows}</table>`,
    );
  }

  function postToJobs(code) {
    // The real cabinet posts the code from its own page, in the same tab, so the Origin is the cabinet's.
    return page(
      "Signing in…",
      `<form id="f" method="post" action="${escapeHtml(jobsUrl)}/auth/cabinet">
         <input type="hidden" name="code" value="${code}"><noscript><button>Continue</button></noscript></form>
       <script>document.getElementById("f").submit()</script>`,
    );
  }

  return { server, issueCode, setActive };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function page(title, body) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:15px system-ui;margin:2rem;max-width:60rem}td,th{padding:.3rem .6rem;text-align:left}</style>
<h1>${escapeHtml(title)}</h1>${body}</html>`;
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DEV_BACKEND_PORT || 3739);
  const { server } = createBackendStub({
    secret: process.env.JOBSYNC_API_SECRET,
    jobsUrl: (process.env.NEXTAUTH_URL || "http://localhost:3737").replace(/\/+$/, ""),
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Local SkillKlan backend: http://127.0.0.1:${port} (cabinet page at /)`);
    if (!process.env.JOBSYNC_API_SECRET) {
      console.log("JOBSYNC_API_SECRET is not set: the API answers 503, like the backend without its secret.");
    }
  });
}
