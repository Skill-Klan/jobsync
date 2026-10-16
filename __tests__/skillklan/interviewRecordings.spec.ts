// @vitest-environment node
// Requirement — the owner, 2026-10-16: every student can listen to every
// interview recording; uploads stay with the Telegram bot; listening loads the
// file from Google Drive. Hence:
//   · read-only access: a service account asking only for drive.readonly — no
//     key of the bot's, nothing of Google's in the browser;
//   · the library is the six bot folders, recordings only, newest first, each
//     with its kind (folder) and what its name says;
//   · only files from the library are served; the browser's Range goes to
//     Drive as is (seeking), a malformed one is dropped;
//   · no configuration → no library (the page stays as it was).
// Google is a fake; the service account key is a real RSA key made here, so
// the signature is checked for real.
import { createVerify, generateKeyPairSync } from "crypto";
import {
  LIST_TTL_MS,
  __resetRecordingsCacheForTests,
  fetchRecordingBytes,
  findRecording,
  isRecordingsConfigured,
  listRecordings,
  recordingsConfig,
} from "@/skillklan/interviewRecordings";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const SA = { client_email: "recordings-reader@example.iam.gserviceaccount.com", private_key: KEY_PEM };

const FOLDERS = {
  INTERVIEW_RECORDINGS_FOLDER_QA_RECRUITER: "folderQaRecruiter01",
  INTERVIEW_RECORDINGS_FOLDER_QA_TECH: "folderQaTech0000001",
  INTERVIEW_RECORDINGS_FOLDER_BA_MANAGER: "folderBaManager0001",
};
const ENV_KEYS = ["INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON", ...Object.keys(FOLDERS),
  "INTERVIEW_RECORDINGS_FOLDER_QA_MANAGER", "INTERVIEW_RECORDINGS_FOLDER_BA_RECRUITER", "INTERVIEW_RECORDINGS_FOLDER_BA_TECH"];

function configure(sa: string = JSON.stringify(SA)) {
  process.env.INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON = sa;
  Object.assign(process.env, FOLDERS);
}

type File = { id: string; name: string; mimeType: string; size?: string; createdTime: string };
const filesByFolder: Record<string, File[][]> = {};
let fetchMock: ReturnType<typeof vi.fn>;
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const callsTo = (prefix: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix));

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  __resetRecordingsCacheForTests();
  vi.useRealTimers();
  filesByFolder.folderQaRecruiter01 = [[
    { id: "fileQaRec0001", name: "02.09.2026 - Олена Коваль - SoftServe.m4a", mimeType: "audio/mp4", size: "1000", createdTime: "2026-09-02T10:00:00Z" },
    { id: "fileNotAudio1", name: "Як завантажувати.gdoc", mimeType: "application/vnd.google-apps.document", createdTime: "2026-09-01T10:00:00Z" },
  ]];
  // Two pages: the library must not stop at the first one.
  filesByFolder.folderQaTech0000001 = [
    [{ id: "fileQaTech001", name: "24.09.2026 - Mobile+API - Іван Петренко - Monobank.mp3", mimeType: "audio/mpeg", size: "2000", createdTime: "2026-09-24T12:00:00Z" }],
    [{ id: "fileQaTech002", name: "voice message.ogg", mimeType: "audio/ogg", createdTime: "2026-10-01T08:00:00Z" }],
  ];
  filesByFolder.folderBaManager0001 = [[
    { id: "fileBaMgr0001", name: "10.10.2026 - Марія Іваненко - Ajax.mp3", mimeType: "audio/mpeg", createdTime: "2026-10-10T09:00:00Z" },
  ]];
  fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.href === "https://oauth2.googleapis.com/token") {
      return json(200, { access_token: "ya29.test-token", expires_in: 3600 });
    }
    if (url.pathname === "/drive/v3/files") {
      const folder = /^'([^']+)' in parents/.exec(url.searchParams.get("q") ?? "")?.[1] ?? "";
      const pages = filesByFolder[folder] ?? [[]];
      const page = Number(url.searchParams.get("pageToken") ?? 0);
      return json(200, { files: pages[page], ...(page + 1 < pages.length ? { nextPageToken: String(page + 1) } : {}) });
    }
    if (url.pathname.startsWith("/drive/v3/files/")) {
      return Promise.resolve(new Response("bytes", { status: (init?.headers as Record<string, string>)?.range ? 206 : 200 }));
    }
    return json(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("configuration", () => {
  it("nothing set → no library, and Google is never called", async () => {
    expect(isRecordingsConfigured()).toBe(false);
    await expect(listRecordings()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the key as JSON or as base64 JSON", () => {
    configure();
    expect(recordingsConfig()?.account.client_email).toBe(SA.client_email);
    configure(Buffer.from(JSON.stringify(SA)).toString("base64"));
    expect(recordingsConfig()?.account.client_email).toBe(SA.client_email);
  });

  it.each([
    ["not JSON", "not-a-key"],
    ["no private key", JSON.stringify({ client_email: SA.client_email })],
  ])("a broken key (%s) → no library", (_label, raw) => {
    configure(raw);
    expect(recordingsConfig()).toBeNull();
  });

  it("a key but no folder, or a folder id that is not one → no library / that folder skipped", () => {
    process.env.INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON = JSON.stringify(SA);
    expect(recordingsConfig()).toBeNull();
    process.env.INTERVIEW_RECORDINGS_FOLDER_QA_TECH = "x' or name contains 'a";
    expect(recordingsConfig()).toBeNull();
    process.env.INTERVIEW_RECORDINGS_FOLDER_QA_MANAGER = "folderQaManager0001";
    expect(recordingsConfig()?.folders).toEqual([{ kind: "qaManager", folderId: "folderQaManager0001" }]);
  });
});

describe("access to Google — read-only, signed by the service account", () => {
  it("asks for drive.readonly with a JWT signed by the account's key", async () => {
    configure();
    await listRecordings();
    const [, init] = callsTo("https://oauth2.googleapis.com/token")[0];
    const form = new URLSearchParams(String(init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [header, claims, signature] = String(form.get("assertion")).split(".");
    const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toMatchObject({
      iss: SA.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
    });
    const verify = createVerify("RSA-SHA256");
    verify.update(`${header}.${claims}`);
    expect(verify.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("one token for many calls while it is valid", async () => {
    configure();
    await listRecordings();
    await listRecordings({ fresh: true });
    expect(callsTo("https://oauth2.googleapis.com/token")).toHaveLength(1);
  });

  it("Google refuses the token → the library fails loudly (the page shows 'could not load')", async () => {
    configure();
    fetchMock.mockImplementationOnce(() => json(401, { error: "invalid_grant" }));
    await expect(listRecordings()).rejects.toThrow("google token: 401");
  });
});

describe("the library", () => {
  beforeEach(() => configure());

  it("the configured folders, recordings only, every page, newest interview first, with kind and name parts", async () => {
    const recordings = await listRecordings();
    expect(recordings.map((r) => [r.id, r.kind, r.date])).toEqual([
      ["fileBaMgr0001", "baManager", "2026-10-10"],
      ["fileQaTech002", "qaTech", null], // no date in the name → its upload day, 2026-10-01
      ["fileQaTech001", "qaTech", "2026-09-24"],
      ["fileQaRec0001", "qaRecruiter", "2026-09-02"],
    ]);
    expect(recordings.find((r) => r.id === "fileQaTech001")).toMatchObject({
      specializations: ["Mobile", "API"],
      person: "Іван Петренко",
      company: "Monobank",
      mimeType: "audio/mpeg",
      size: 2000,
    });
    const listQuery = new URL(String(callsTo("https://www.googleapis.com/drive/v3/files?")[0][0])).searchParams;
    expect(listQuery.get("supportsAllDrives")).toBe("true");
    expect(listQuery.get("includeItemsFromAllDrives")).toBe("true");
  });

  it("cached for 5 minutes, then read again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    await listRecordings();
    const after = () => callsTo("https://www.googleapis.com/drive/v3/files?").length;
    const first = after();
    vi.setSystemTime(new Date(Date.now() + LIST_TTL_MS - 1000));
    await listRecordings();
    expect(after()).toBe(first);
    vi.setSystemTime(new Date(Date.now() + 2000));
    await listRecordings();
    expect(after()).toBe(first * 2);
  });

  it("findRecording: a library file → it; a new upload not yet in the cache → found after one fresh read", async () => {
    await expect(findRecording("fileQaRec0001")).resolves.toMatchObject({ kind: "qaRecruiter" });
    filesByFolder.folderBaManager0001[0].push({
      id: "fileBaMgrNew1", name: "16.10.2026 - Нова Людина - EPAM.mp3", mimeType: "audio/mpeg", createdTime: "2026-10-16T09:00:00Z",
    });
    await expect(findRecording("fileBaMgrNew1")).resolves.toMatchObject({ company: "EPAM" });
  });

  it("findRecording: a file outside the library (or not an id at all) → null", async () => {
    await expect(findRecording("fileNotAudio1")).resolves.toBeNull();
    await expect(findRecording("someoneElsesFile")).resolves.toBeNull();
    const before = fetchMock.mock.calls.length;
    await expect(findRecording("../../etc/passwd")).resolves.toBeNull();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});

describe("the bytes", () => {
  beforeEach(() => configure());

  it("straight from Drive with the browser's Range (seeking), through all drives", async () => {
    const res = await fetchRecordingBytes("fileQaTech001", "bytes=1000-");
    expect(res.status).toBe(206);
    const [url, init] = callsTo("https://www.googleapis.com/drive/v3/files/fileQaTech001")[0];
    expect(String(url)).toBe("https://www.googleapis.com/drive/v3/files/fileQaTech001?alt=media&supportsAllDrives=true");
    expect(init.headers).toMatchObject({ authorization: "Bearer ya29.test-token", range: "bytes=1000-" });
  });

  it("a malformed Range is not passed on", async () => {
    await fetchRecordingBytes("fileQaTech001", "bytes=0-1\r\nx-evil: 1");
    const [, init] = callsTo("https://www.googleapis.com/drive/v3/files/fileQaTech001")[0];
    expect(init.headers).not.toHaveProperty("range");
  });
});
