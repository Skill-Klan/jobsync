// @vitest-environment node
// Requirement — the owner, 2026-10-16: every student can listen to every
// interview recording; uploads stay with the Telegram bot; listening loads the
// file from Google Drive. Hence:
//   · read-only access: a service account asking only for drive.readonly — no
//     key of the bot's, nothing of Google's in the browser;
//   · the library is every REVIEWED recording (owner 2026-10-18: the QA and BA
//     folders «have different directories, we need them all»; recordings
//     waiting for review are not shown). On Drive: kind folder → the bot's
//     upload folder («pending for review») + a folder per company (with
//     sub-folders). So: everything under each upload folder's parent, except
//     the upload folder; kind from the kind folder, company from the company
//     folder; recordings only, newest first, undated after the dated;
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

// A fake Drive, shaped like the real one (2026-10-18): what the service
// account sees — folders and files with their parents.
type Item = { id: string; name: string; mimeType: string; parents?: string[]; size?: string; createdTime: string };
const FOLDER = "application/vnd.google-apps.folder";
const folder = (id: string, name: string, parent?: string): Item =>
  ({ id, name, mimeType: FOLDER, parents: parent ? [parent] : undefined, createdTime: "2026-01-01T00:00:00Z" });
const file = (id: string, name: string, parent: string, createdTime: string, mimeType = "audio/mpeg", size?: string): Item =>
  ({ id, name, mimeType, parents: [parent], createdTime, ...(size ? { size } : {}) });
let drive: Item[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const callsTo = (prefix: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix));
// Each list comes back in pages of two: the library must read them all.
const PAGE = 2;

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  __resetRecordingsCacheForTests();
  vi.useRealTimers();
  drive = [
    // QA: the root is not shared up to its parent — the account starts here.
    folder("rootQa0000001", "Interviews (HR, Tech) (new)"),
    folder("kindQaTech001", "Tech_Interviews", "rootQa0000001"),
    folder("folderQaTech0000001", "pending for review", "kindQaTech001"), // the bot's upload folder
    folder("pendingOld001", "old", "folderQaTech0000001"),
    folder("coEpam0000001", "EPAM", "kindQaTech001"),
    folder("coEpam2025001", "2025", "coEpam0000001"),
    folder("coMonobank001", "Monobank", "kindQaTech001"),
    folder("kindQaRec0001", "HR_Interviews", "rootQa0000001"),
    folder("folderQaRecruiter01", "pending for review", "kindQaRec0001"),
    folder("coSoftServe01", " SoftServe ", "kindQaRec0001"),
    folder("prepFolder001", "Підготовка до співбесід", "rootQa0000001"),
    // BA
    folder("rootBa0000001", "Записи співбесід"),
    folder("kindBaMgr0001", "Менеджерська", "rootBa0000001"),
    folder("folderBaManager0001", "Pending_review", "kindBaMgr0001"),
    folder("coAjax0000001", "Ajax", "kindBaMgr0001"),
    // reviewed — in a company's folder
    file("fileQaTech001", "24.09.2026 - Mobile+API - Іван Петренко - Monobank.mp3", "coMonobank001", "2026-09-24T12:00:00Z", "audio/mpeg", "2000"),
    file("fileQaRec0001", "02.09.2026 - Олена Коваль - SoftServe.m4a", "coSoftServe01", "2026-09-02T10:00:00Z", "audio/mp4", "1000"),
    file("fileBaMgr0001", "10.10.2026 - Марія Іваненко - Ajax.mp3", "coAjax0000001", "2026-10-10T09:00:00Z"),
    file("fileEpamBot01", "05.08.2026 - Петро Сидоренко - Monobank.mp3", "coEpam0000001", "2026-08-05T09:00:00Z"),
    // the archive's own names; the archive was uploaded in one go on 2026-03-27
    file("fileEpamOld01", "Іван_Петренко_QA_24.09.25.m4a", "coEpam0000001", "2026-03-27T10:00:00Z", "audio/mp4"),
    file("fileEpamDeep1", "voice message.ogg", "coEpam2025001", "2026-03-27T10:05:00Z", "audio/ogg"),
    file("fileEpamDeep2", "запис 2.ogg", "coEpam2025001", "2026-03-27T10:01:00Z", "audio/ogg"),
    file("fileNotAudio1", "Як завантажувати.gdoc", "coMonobank001", "2026-09-01T10:00:00Z", "application/vnd.google-apps.document"),
    // waiting for review — not in the library
    file("filePending01", "16.10.2026 - Нова Людина - EPAM.mp3", "folderQaTech0000001", "2026-10-16T09:00:00Z"),
    file("filePending02", "01.10.2026 - Інша Людина - Ajax.mp3", "pendingOld001", "2026-10-01T09:00:00Z"),
    // outside every kind folder — not in the library
    file("filePrep00001", "Лекція про співбесіди.mp4", "prepFolder001", "2026-05-01T09:00:00Z", "video/mp4"),
    file("fileElsewhere", "чужий запис.mp3", "notSharedFolder1", "2026-05-01T09:00:00Z"),
  ];
  fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.href === "https://oauth2.googleapis.com/token") {
      return json(200, { access_token: "ya29.test-token", expires_in: 3600 });
    }
    if (url.pathname === "/drive/v3/files") {
      // The two queries the library makes; Drive filters by type itself.
      const q = url.searchParams.get("q") ?? "";
      const notTrashed = q.includes("trashed = false");
      let found: Item[] | null = null;
      if (notTrashed && q.includes(`mimeType = '${FOLDER}'`)) found = drive.filter((i) => i.mimeType === FOLDER);
      if (notTrashed && q.includes("mimeType contains 'audio/'") && q.includes("mimeType contains 'video/'")) {
        found = drive.filter((i) => i.mimeType.startsWith("audio/") || i.mimeType.startsWith("video/"));
      }
      if (!found) return json(400, { error: { message: `unexpected query: ${q}` } });
      const page = Number(url.searchParams.get("pageToken") ?? 0);
      const next = (page + 1) * PAGE < found.length ? { nextPageToken: String(page + 1) } : {};
      return json(200, { files: found.slice(page * PAGE, (page + 1) * PAGE), ...next });
    }
    if (url.pathname.startsWith("/drive/v3/files/")) {
      const id = url.pathname.slice("/drive/v3/files/".length);
      if (url.searchParams.get("alt") === "media") {
        return Promise.resolve(new Response("bytes", { status: (init?.headers as Record<string, string>)?.range ? 206 : 200 }));
      }
      const item = drive.find((i) => i.id === id);
      return item ? json(200, { parents: item.parents }) : json(404, { error: { message: "File not found" } });
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

  it("every reviewed recording under the kind folders — company folders and their sub-folders, every page", async () => {
    const recordings = await listRecordings();
    expect(recordings.map((r) => r.id).sort()).toEqual([
      "fileBaMgr0001", "fileEpamBot01", "fileEpamDeep1", "fileEpamDeep2", "fileEpamOld01", "fileQaRec0001", "fileQaTech001",
    ]);
    // Both lists came in more than one page.
    const pagesAsked = callsTo("https://www.googleapis.com/drive/v3/files?")
      .filter(([u]) => new URL(String(u)).searchParams.has("pageToken")).length;
    expect(pagesAsked).toBeGreaterThanOrEqual(2);
    const listQuery = new URL(String(callsTo("https://www.googleapis.com/drive/v3/files?")[0][0])).searchParams;
    expect(listQuery.get("supportsAllDrives")).toBe("true");
    expect(listQuery.get("includeItemsFromAllDrives")).toBe("true");
  });

  it("waiting for review (the bot's upload folder and anything in it) → not in the library", async () => {
    const ids = (await listRecordings()).map((r) => r.id);
    expect(ids).not.toContain("filePending01");
    expect(ids).not.toContain("filePending02");
    // Pair: the same kind of file, reviewed, is there.
    expect(ids).toContain("fileEpamBot01");
  });

  it("outside every kind folder (interview prep, a folder of someone else's) → not in the library", async () => {
    const ids = (await listRecordings()).map((r) => r.id);
    expect(ids).not.toContain("filePrep00001");
    expect(ids).not.toContain("fileElsewhere");
    expect(ids).not.toContain("fileNotAudio1");
  });

  it("kind from the kind folder, company from the company folder — also below it, and over what the name says", async () => {
    const byId = new Map((await listRecordings()).map((r) => [r.id, r]));
    expect(byId.get("fileQaTech001")).toMatchObject({
      kind: "qaTech", company: "Monobank", person: "Іван Петренко", specializations: ["Mobile", "API"], mimeType: "audio/mpeg", size: 2000,
    });
    expect(byId.get("fileQaRec0001")).toMatchObject({ kind: "qaRecruiter", company: "SoftServe" });
    expect(byId.get("fileBaMgr0001")).toMatchObject({ kind: "baManager", company: "Ajax" });
    // The name says Monobank, the team put it into EPAM's folder.
    expect(byId.get("fileEpamBot01")).toMatchObject({ company: "EPAM", person: "Петро Сидоренко" });
    expect(byId.get("fileEpamDeep1")).toMatchObject({ kind: "qaTech", company: "EPAM", person: null, title: "voice message" });
    expect(byId.get("fileEpamOld01")).toMatchObject({ company: "EPAM", person: null, title: "Іван_Петренко_QA_24.09.25" });
  });

  it("newest interview first by the date in the name; without one — after them, by upload time", async () => {
    const recordings = await listRecordings();
    expect(recordings.map((r) => [r.id, r.date])).toEqual([
      ["fileBaMgr0001", "2026-10-10"],
      ["fileQaTech001", "2026-09-24"],
      ["fileQaRec0001", "2026-09-02"],
      ["fileEpamBot01", "2026-08-05"],
      ["fileEpamOld01", "2025-09-24"], // `…_24.09.25` — the archive's name, uploaded on 2026-03-27
      ["fileEpamDeep1", null],
      ["fileEpamDeep2", null],
    ]);
  });

  it("a loop of folders does not hang the list", async () => {
    drive.push(folder("loopA00000001", "A", "loopB00000001"), folder("loopB00000001", "B", "loopA00000001"));
    drive.push(file("fileInLoop001", "x.mp3", "loopA00000001", "2026-05-01T09:00:00Z"));
    expect((await listRecordings()).map((r) => r.id)).not.toContain("fileInLoop001");
  });

  it("an upload folder Drive does not know → the library fails loudly (the page shows 'could not load')", async () => {
    drive = drive.filter((i) => i.id !== "folderBaManager0001");
    await expect(listRecordings()).rejects.toThrow("drive folder: 404");
  });

  it("cached for 5 minutes, then read again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    await listRecordings();
    const after = () => callsTo("https://www.googleapis.com/drive/v3/files").length;
    const first = after();
    vi.setSystemTime(new Date(Date.now() + LIST_TTL_MS - 1000));
    await listRecordings();
    expect(after()).toBe(first);
    vi.setSystemTime(new Date(Date.now() + 2000));
    await listRecordings();
    expect(after()).toBe(first * 2);
  });

  it("findRecording: a library file → it; reviewed after the list was cached → found after one fresh read", async () => {
    await expect(findRecording("fileQaRec0001")).resolves.toMatchObject({ kind: "qaRecruiter" });
    await expect(findRecording("filePending01")).resolves.toBeNull();
    // The team reviews it: moved from «pending for review» into EPAM's folder.
    drive.find((i) => i.id === "filePending01")!.parents = ["coEpam0000001"];
    await expect(findRecording("filePending01")).resolves.toMatchObject({ company: "EPAM", kind: "qaTech" });
  });

  it("findRecording: waiting for review, outside the library, or not an id at all → null (never served)", async () => {
    await expect(findRecording("filePending02")).resolves.toBeNull();
    await expect(findRecording("filePrep00001")).resolves.toBeNull();
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
