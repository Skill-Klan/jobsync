import "server-only";
import { createSign } from "crypto";
import { parseRecordingName, type RecordingNameParts } from "./recordingName";
import type { RecordingKind } from "./recordingKinds";

// The interview recordings library (owner 2026-10-16): every student hears
// every recording; recordings keep being uploaded by the Telegram bot into
// six Google Drive folders, and SkillKlan Job only reads them. The files stay
// in Drive; this server lists them and streams one to the browser on request,
// so access follows SkillKlan Job's own rules (an excluded student is out
// within 5 minutes) and no Google key reaches the browser.
//
// Read-only and least privilege: a service account with drive.readonly that
// the six folders are shared with — not the bot's key to a personal Drive.
//
// Configuration (app.env on Server2; no configuration → no library):
//   INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON — the service account key (JSON,
//     or the same JSON in base64);
//   INTERVIEW_RECORDINGS_FOLDER_<KIND> — the folder ids, the same as the bot's
//     GOOGLE_DRIVE_FOLDER_ID_{HR,TECH,MANAGER,BA_RECRUITER,BA_TECH,BA_MANAGER}.

export const RECORDING_FOLDER_ENV: Record<RecordingKind, string> = {
  qaRecruiter: "INTERVIEW_RECORDINGS_FOLDER_QA_RECRUITER",
  qaTech: "INTERVIEW_RECORDINGS_FOLDER_QA_TECH",
  qaManager: "INTERVIEW_RECORDINGS_FOLDER_QA_MANAGER",
  baRecruiter: "INTERVIEW_RECORDINGS_FOLDER_BA_RECRUITER",
  baTech: "INTERVIEW_RECORDINGS_FOLDER_BA_TECH",
  baManager: "INTERVIEW_RECORDINGS_FOLDER_BA_MANAGER",
};

export type Recording = RecordingNameParts & {
  id: string;
  kind: RecordingKind;
  mimeType: string;
  size: number | null;
  uploadedAt: string; // ISO, Drive's createdTime
};

type ServiceAccount = { client_email: string; private_key: string };
type Config = { account: ServiceAccount; folders: { kind: RecordingKind; folderId: string }[] };

const DRIVE = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const GOOGLE_TIMEOUT_MS = 10_000;
// The list is cached: six folder reads per page view would be slow and add
// nothing — the bot adds a few recordings a day.
export const LIST_TTL_MS = 5 * 60 * 1000;
// A Drive folder id: letters, digits, "-" and "_". Anything else is not put
// into a query string.
const FOLDER_ID = /^[A-Za-z0-9_-]{10,100}$/;
const FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;

function readAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const json = JSON.parse(text) as Partial<ServiceAccount>;
    if (typeof json.client_email !== "string" || typeof json.private_key !== "string") return null;
    return { client_email: json.client_email, private_key: json.private_key };
  } catch {
    return null;
  }
}

export function recordingsConfig(env: NodeJS.ProcessEnv = process.env): Config | null {
  const account = readAccount(env.INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON);
  if (!account) return null;
  const folders = (Object.keys(RECORDING_FOLDER_ENV) as RecordingKind[]).flatMap((kind) => {
    const folderId = env[RECORDING_FOLDER_ENV[kind]]?.trim();
    return folderId && FOLDER_ID.test(folderId) ? [{ kind, folderId }] : [];
  });
  return folders.length > 0 ? { account, folders } : null;
}

export function isRecordingsConfigured(): boolean {
  return recordingsConfig() !== null;
}

// --- access token (service account, JWT bearer grant) ------------------------

declare const globalThis: {
  skillklanRecordings?: {
    token?: { value: string; expiresAt: number; email: string };
    list?: { at: number; recordings: Recording[] };
  };
} & typeof global;
const cache = (globalThis.skillklanRecordings ??= {});

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function withTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Date.now();
  const held = cache.token;
  if (held && held.email === account.client_email && held.expiresAt - 60_000 > now) return held.value;

  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(account.private_key))}`;

  const res = await withTimeout(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  if (!res.ok) throw new Error(`google token: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("google token: no access_token");
  cache.token = {
    value: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
    email: account.client_email,
  };
  return body.access_token;
}

// --- the library -------------------------------------------------------------

type DriveFile = { id: string; name: string; mimeType: string; size?: string; createdTime: string };

async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await withTimeout(`${DRIVE}/files?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`drive list: ${res.status}`);
    const body = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

// Only recordings: the bot uploads audio; anything else in a folder (a note,
// a sub-folder) is not part of the library.
function isRecording(file: DriveFile): boolean {
  return file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/");
}

// Newest interview first — by the date in the name, else by upload time.
function byNewest(a: Recording, b: Recording): number {
  const ka = a.date ?? a.uploadedAt.slice(0, 10);
  const kb = b.date ?? b.uploadedAt.slice(0, 10);
  return kb.localeCompare(ka) || b.uploadedAt.localeCompare(a.uploadedAt);
}

export async function listRecordings(options: { fresh?: boolean } = {}): Promise<Recording[]> {
  const config = recordingsConfig();
  if (!config) return [];
  const held = cache.list;
  if (!options.fresh && held && Date.now() - held.at < LIST_TTL_MS) return held.recordings;

  const token = await accessToken(config.account);
  const perFolder = await Promise.all(
    config.folders.map(async ({ kind, folderId }) =>
      (await listFolder(token, folderId)).filter(isRecording).map(
        (file): Recording => ({
          ...parseRecordingName(file.name),
          id: file.id,
          kind,
          mimeType: file.mimeType,
          size: file.size ? Number(file.size) : null,
          uploadedAt: file.createdTime,
        }),
      ),
    ),
  );
  const recordings = perFolder.flat().sort(byNewest);
  cache.list = { at: Date.now(), recordings };
  return recordings;
}

// A file id is served only if it is in the library: the service account may
// be able to read more than these six folders one day.
export async function findRecording(id: string): Promise<Recording | null> {
  if (!FILE_ID.test(id)) return null;
  const inList = (list: Recording[]) => list.find((r) => r.id === id) ?? null;
  return inList(await listRecordings()) ?? inList(await listRecordings({ fresh: true }));
}

// The bytes, straight from Drive — with the browser's Range, so the player
// can seek without downloading the whole file first.
export async function fetchRecordingBytes(
  id: string,
  range: string | null,
  listener?: AbortSignal,
): Promise<Response> {
  const config = recordingsConfig();
  if (!config) throw new Error("recordings: not configured");
  const token = await accessToken(config.account);
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.range = range;
  // A deadline for Google to start answering — not for the whole body: a long
  // recording takes longer than that to send. The listener leaving (closed
  // tab, seek) stops the download from Drive too.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), GOOGLE_TIMEOUT_MS);
  const signal = listener ? AbortSignal.any([listener, deadline.signal]) : deadline.signal;
  try {
    return await fetch(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, {
      headers,
      cache: "no-store",
      signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Tests only: forget the cached token and list.
export function __resetRecordingsCacheForTests(): void {
  delete cache.token;
  delete cache.list;
}
