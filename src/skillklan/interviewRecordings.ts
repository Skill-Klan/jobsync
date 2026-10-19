import "server-only";
import { createSign } from "crypto";
import { parseRecordingName, type RecordingNameParts } from "./recordingName";
import type { RecordingKind } from "./recordingKinds";
import {
  GOOGLE_EXPORTED_TO_PDF,
  attachmentView,
  recordingOf,
  type Attachment,
} from "./recordingAttachments";

// The interview recordings library (owner 2026-10-16): every student hears
// every recording; recordings keep being uploaded by the Telegram bot to
// Google Drive, and SkillKlan Job only reads them. The files stay in Drive;
// this server lists them and streams one to the browser on request, so access
// follows SkillKlan Job's own rules (an excluded student is out within 5
// minutes) and no Google key reaches the browser.
//
// What is in it (owner 2026-10-18): every REVIEWED recording. On Drive each
// kind of interview has its folder (QA: Tech_Interviews, HR_Interviews,
// Manager_Interviews; BA: «Скрінінг з рекрутером», «Технічна», «Менеджерська»)
// with a folder per company inside. The bot uploads into one more folder there
// («pending for review» / «Pending_review»), and the team moves a recording
// into its company's folder once it is reviewed. So for each configured
// upload folder: its parent is the kind folder; the library is every
// recording anywhere under the kind folder except under the upload folder;
// the company is the folder right under the kind folder (file names are not
// uniform enough to say it).
//
// Read-only and least privilege: a service account with drive.readonly that
// the folders are shared with — not the bot's key to a personal Drive.
//
// Configuration (app.env on Server2; no configuration → no library):
//   INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON — the service account key (JSON,
//     or the same JSON in base64);
//   INTERVIEW_RECORDINGS_FOLDER_<KIND> — the bot's upload folders, the same as
//     its GOOGLE_DRIVE_FOLDER_ID_{HR,TECH,MANAGER,BA_RECRUITER,BA_TECH,BA_MANAGER}.
//     The account must see their parents too (share the parent folders).

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
  // The folders below the company's, e.g. one candidate's `Імʼя_Прізвище_AQA`
  // (" / " between levels); null — right in the company's folder.
  folder: string | null;
};

type ServiceAccount = { client_email: string; private_key: string };
type Config = { account: ServiceAccount; folders: { kind: RecordingKind; folderId: string }[] };

const DRIVE = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const GOOGLE_TIMEOUT_MS = 10_000;
export const ATTACHMENT_READ_MS = 60_000;
// The list is cached: reading the folders per page view would be slow and add
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
    list?: { at: number; recordings: Recording[]; attachments: Attachment[] };
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

type DriveFolder = { id: string; name: string; parents?: string[] };
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  parents?: string[];
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
// Drive has no "everything under this folder" query: the whole tree the
// account sees comes in two lists (folders, recordings) and is put together
// here — instead of one request per folder (there are hundreds).
const ALL_FOLDERS = `mimeType = '${FOLDER_MIME}' and trashed = false`;
const ALL_RECORDINGS = "trashed = false and (mimeType contains 'audio/' or mimeType contains 'video/')";
// Everything else that is a file — the attachments (owner 2026-10-19). A third
// list rather than one list of all files: the recordings' query stays as it
// was, and a failure here costs the attachments only, never the library.
const ALL_OTHER_FILES =
  `trashed = false and mimeType != '${FOLDER_MIME}' and ` +
  "not mimeType contains 'audio/' and not mimeType contains 'video/'";
// Deeper than this is a loop or not a company archive.
const MAX_DEPTH = 32;

async function driveGet(token: string, url: string, what: string): Promise<unknown> {
  const res = await withTimeout(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`drive ${what}: ${res.status}`);
  return res.json();
}

async function driveList<T>(token: string, q: string, fields: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      fields: `nextPageToken, files(${fields})`,
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const body = (await driveGet(token, `${DRIVE}/files?${params}`, "list")) as {
      files?: T[];
      nextPageToken?: string;
    };
    items.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return items;
}

async function parentOf(token: string, folderId: string): Promise<string | null> {
  const body = (await driveGet(
    token,
    `${DRIVE}/files/${folderId}?fields=parents&supportsAllDrives=true`,
    "folder",
  )) as { parents?: string[] };
  return body.parents?.[0] ?? null;
}

// Only recordings: anything else in a folder (a note, a document) is not part
// of the library.
function isRecording(file: DriveFile): boolean {
  return file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/");
}

type Place = { kind: RecordingKind; company: string | null; folder: string | null };

// Where a file sits: under which kind folder, which company folder and which
// folders below it — or nowhere in the library (outside every kind folder, or
// still in the bot's upload folder, waiting for review).
function placeOf(
  parentId: string | undefined,
  folders: Map<string, DriveFolder>,
  kindFolders: Map<string, RecordingKind>,
  uploadFolders: Set<string>,
): Place | null {
  const walked: DriveFolder[] = []; // from the file's folder up
  let id = parentId;
  for (let depth = 0; id && depth < MAX_DEPTH; depth++) {
    if (uploadFolders.has(id)) return null;
    const kind = kindFolders.get(id);
    if (kind) {
      const company = walked.at(-1)?.name.trim() || null;
      const below = walked
        .slice(0, -1)
        .reverse()
        .map((f) => f.name.trim())
        .filter(Boolean);
      return { kind, company, folder: below.length > 0 ? below.join(" / ") : null };
    }
    const folder = folders.get(id);
    if (!folder) return null;
    walked.push(folder);
    id = folder.parents?.[0];
  }
  return null;
}

// Newest interview first — by the date in the name; recordings without one
// after them, by upload time. Not by upload time among the dated: most of the
// archive was uploaded in one go (2026-03-27), long after the interviews.
function byNewest(a: Recording, b: Recording): number {
  if (a.date && b.date) return b.date.localeCompare(a.date) || b.uploadedAt.localeCompare(a.uploadedAt);
  if (a.date || b.date) return a.date ? -1 : 1;
  return b.uploadedAt.localeCompare(a.uploadedAt);
}

export type Library = { recordings: Recording[]; attachments: Attachment[] };

export async function listRecordings(options: { fresh?: boolean } = {}): Promise<Recording[]> {
  return (await listLibrary(options)).recordings;
}

export async function listLibrary(options: { fresh?: boolean } = {}): Promise<Library> {
  const config = recordingsConfig();
  if (!config) return { recordings: [], attachments: [] };
  const held = cache.list;
  if (!options.fresh && held && Date.now() - held.at < LIST_TTL_MS) return held;

  const token = await accessToken(config.account);
  // The kind folders first: an upload folder Drive does not know fails here,
  // before the long lists start (they would page on after the failure).
  const parents = await Promise.all(config.folders.map(({ folderId }) => parentOf(token, folderId)));
  const [folders, files, others] = await Promise.all([
    driveList<DriveFolder>(token, ALL_FOLDERS, "id, name, parents"),
    driveList<DriveFile>(token, ALL_RECORDINGS, "id, name, mimeType, size, createdTime, parents"),
    driveList<DriveFile>(token, ALL_OTHER_FILES, "id, name, mimeType, size, parents").catch((error: unknown) => {
      console.error(
        "[interview-recordings] attachments list failed",
        error instanceof Error ? error.message : "unknown",
      );
      return [] as DriveFile[];
    }),
  ]);
  const kindFolders = new Map<string, RecordingKind>();
  config.folders.forEach(({ kind }, i) => {
    const parent = parents[i];
    if (parent) kindFolders.set(parent, kind);
  });
  const uploadFolders = new Set(config.folders.map(({ folderId }) => folderId));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  // The library's recordings by the folder they lie in — whom an attachment
  // lying next to them can belong to.
  const inFolder = new Map<string, { id: string; name: string }[]>();
  const recordings = files.filter(isRecording).flatMap((file): Recording[] => {
    const place = placeOf(file.parents?.[0], folderById, kindFolders, uploadFolders);
    if (!place) return [];
    const parent = file.parents?.[0];
    if (parent) inFolder.set(parent, [...(inFolder.get(parent) ?? []), { id: file.id, name: file.name }]);
    const named = parseRecordingName(file.name);
    return [
      {
        ...named,
        company: place.company ?? named.company,
        id: file.id,
        kind: place.kind,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : null,
        uploadedAt: file.createdTime,
        folder: place.folder,
      },
    ];
  });
  recordings.sort(byNewest);

  // Attachments: files in the library's company folders (and below), the same
  // places the recordings come from — not the bot's upload folder, not the
  // kind folder itself (no company, no recording beside them), nothing else
  // the account can read («Підготовка до співбесід» and the like).
  const attachments = others.flatMap((file): Attachment[] => {
    const place = placeOf(file.parents?.[0], folderById, kindFolders, uploadFolders);
    if (!place || !place.company) return [];
    const siblings = inFolder.get(file.parents?.[0] ?? "") ?? [];
    return [
      {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : null,
        kind: place.kind,
        company: place.company,
        folder: place.folder,
        recordingId: recordingOf(file.name, siblings),
        view: attachmentView(file.mimeType, file.name),
      },
    ];
  });
  attachments.sort((a, b) => a.name.localeCompare(b.name, "uk"));

  const library = { at: Date.now(), recordings, attachments };
  cache.list = library;
  return library;
}

// A file id is served only if it is in the library: the service account reads
// more than that (recordings waiting for review, other folders shared with it).
export async function findRecording(id: string): Promise<Recording | null> {
  if (!FILE_ID.test(id)) return null;
  const inList = (list: Recording[]) => list.find((r) => r.id === id) ?? null;
  return inList(await listRecordings()) ?? inList(await listRecordings({ fresh: true }));
}

// The same rule for attachments: only a file placed in the library.
export async function findAttachment(id: string): Promise<Attachment | null> {
  if (!FILE_ID.test(id)) return null;
  const inList = (library: Library) => library.attachments.find((a) => a.id === id) ?? null;
  return inList(await listLibrary()) ?? inList(await listLibrary({ fresh: true }));
}

export class AttachmentTooLargeError extends Error {
  constructor() {
    super("attachment: too large");
    this.name = "AttachmentTooLargeError";
  }
}

// An attachment's bytes, whole — at most `limit` of them (a picture or a PDF
// is converted or read in one piece, unlike a recording that streams). Google's
// own documents come exported to PDF (drive.readonly allows it; Drive caps an
// export at 10 MB). `truncate`: past the limit, keep the beginning instead of
// failing (text).
export async function fetchAttachmentBytes(
  attachment: Attachment,
  limit: number,
  options: { truncate?: boolean; signal?: AbortSignal } = {},
): Promise<{ bytes: Buffer; truncated: boolean }> {
  const config = recordingsConfig();
  if (!config) throw new Error("recordings: not configured");
  if (attachment.size !== null && attachment.size > limit && !options.truncate) {
    throw new AttachmentTooLargeError();
  }
  const token = await accessToken(config.account);
  const url = GOOGLE_EXPORTED_TO_PDF.has(attachment.mimeType)
    ? `${DRIVE}/files/${attachment.id}/export?mimeType=${encodeURIComponent("application/pdf")}`
    : `${DRIVE}/files/${attachment.id}?alt=media&supportsAllDrives=true`;
  // Google has GOOGLE_TIMEOUT_MS to start answering and ATTACHMENT_READ_MS to
  // finish: unlike a recording, the whole file is read before anything is sent.
  const deadline = new AbortController();
  const start = setTimeout(() => deadline.abort(), GOOGLE_TIMEOUT_MS);
  const finish = setTimeout(() => deadline.abort(), ATTACHMENT_READ_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;
  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal });
    } finally {
      clearTimeout(start);
    }
    if (!res.ok || !res.body) throw new Error(`drive attachment: ${res.status}`);

    // Counted while reading: Drive's size is absent for exports and may be
    // wrong — the limit holds on what actually arrives.
    const chunks: Buffer[] = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        if (!options.truncate) throw new AttachmentTooLargeError();
        chunks.push(Buffer.from(value.subarray(0, value.byteLength - (total - limit))));
        return { bytes: Buffer.concat(chunks), truncated: true };
      }
      chunks.push(Buffer.from(value));
    }
    return { bytes: Buffer.concat(chunks), truncated: false };
  } finally {
    clearTimeout(finish);
  }
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
