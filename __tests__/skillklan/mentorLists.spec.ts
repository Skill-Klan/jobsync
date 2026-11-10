// @vitest-environment node
// Requirement — docs/contracts/study-plans-mentors.md, decisions D89–D93, D95,
// D98, D99:
//   · the backend answers for the VIEWER: the admin sees every mentor and every
//     student without a mentor; the QA moderator the QA part only; a mentor
//     their own students; a test account nothing else; anyone else, an excluded
//     account, an unknown or malformed id — empty lists, never 404;
//   · the answers have the shapes of docs/contracts/examples/study-plans-mentors.json;
//   · this app's client (src/skillklan/cabinetApi.ts) fails closed: a wrong
//     secret, a non-200, a missing list, a wrong shape → `null` ("could not be
//     loaded"), never an empty list that looks like "nobody"; entries of the
//     wrong shape are skipped;
//   · `mentor` is a role this app knows, with no admin rights (D99).
import type { AddressInfo } from "node:net";
import examples from "../../docs/contracts/examples/study-plans-mentors.json";
import { createBackendStub } from "../../skillklan/dev/backend-stub.mjs";
import {
  exchangeLoginCode,
  getCabinetAccess,
  getViewerMentor,
  isCabinetRole,
  listMentors,
  listMentorStudents,
  listStudentsWithoutMentor,
  managesSkillklanJob,
} from "@/skillklan/cabinetApi";

const SECRET = "local-test-secret-0123456789abcdef";
const STUDENT = 1001;
const ADMIN = 1002;
const QA = 1003;
const MENTOR = 1004;
const EXCLUDED = 1005;

type Stub = ReturnType<typeof createBackendStub>;
const running: Stub[] = [];
async function start(options: Parameters<typeof createBackendStub>[0] = { secret: SECRET }) {
  const stub = createBackendStub(options);
  await new Promise<void>((resolve) => stub.server.listen(0, "127.0.0.1", () => resolve()));
  running.push(stub);
  const { port } = stub.server.address() as AddressInfo;
  return { stub, base: `http://127.0.0.1:${port}` };
}
afterEach(async () => {
  await Promise.all(running.splice(0).map((s) => new Promise((resolve) => s.server.close(resolve))));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function get(base: string, path: string, secret: string | null = SECRET) {
  const res = await fetch(`${base}${path}`, { headers: secret === null ? {} : { "x-jobsync-secret": secret } });
  return { status: res.status, body: await res.json(), cacheControl: res.headers.get("cache-control") };
}
const answer = (r: { status: number; body: unknown }) => ({ status: r.status, body: r.body });
const ids = (list: { userId: number }[] | null) => list?.map((s) => s.userId);

describe("the stand-in answers like the backend", () => {
  it("shapes: the contract's examples, not cached", async () => {
    const { base } = await start();
    const mentors = await get(base, `/api/jobsync/users/${ADMIN}/mentors`);
    expect(answer(mentors)).toEqual(examples.mentors);
    expect(mentors.cacheControl).toBe("no-store");
    const students = await get(base, `/api/jobsync/users/${ADMIN}/mentors/1004/students`);
    expect(students.body.data.students[0]).toEqual(examples.students.body.data.students[0]);
    expect(answer(await get(base, `/api/jobsync/users/${MENTOR}/mentor`))).toEqual(examples.mentor);
    expect(answer(await get(base, `/api/jobsync/users/${QA}/mentor`))).toEqual(examples.notAMentor);
  });

  it("the admin sees every mentor, a mentor's students and the students without a mentor", async () => {
    const { base } = await start();
    const data = async (p: string) => (await get(base, `/api/jobsync/users/${ADMIN}${p}`)).body.data;
    expect((await data("/mentors")).mentors.map((m: { mentorId: number }) => m.mentorId)).toEqual([1004, 1002]);
    expect(ids((await data("/mentors/1004/students")).students)).toEqual([1001, 1006]); // 1005 is excluded
    expect(ids((await data("/mentors/1002/students")).students)).toEqual([1007]);
    expect(ids((await data("/students-without-mentor")).students)).toEqual([1008, 1009]);
  });

  it("the QA moderator sees the QA part only (D90, D95)", async () => {
    const { base } = await start();
    const data = async (p: string) => (await get(base, `/api/jobsync/users/${QA}${p}`)).body.data;
    expect((await data("/mentors")).mentors.map((m: { mentorId: number }) => m.mentorId)).toEqual([1004]);
    expect(ids((await data("/mentors/1004/students")).students)).toEqual([1001, 1006]);
    expect((await data("/mentors/1002/students")).students).toEqual([]); // a BA mentor
    expect(ids((await data("/students-without-mentor")).students)).toEqual([1008]); // QA only
  });

  it("a mentor sees their own students (D98); a test student nothing", async () => {
    const { base } = await start();
    const own = (await get(base, `/api/jobsync/users/${MENTOR}/mentors/1004/students`)).body.data;
    expect(ids(own.students)).toEqual([1001, 1006]);
    expect((await get(base, `/api/jobsync/users/${MENTOR}/mentors/1002/students`)).body.data.students).toEqual([]);
    expect((await get(base, `/api/jobsync/users/${MENTOR}/mentors`)).body.data.mentors).toEqual([]);
    expect((await get(base, `/api/jobsync/users/${MENTOR}/students-without-mentor`)).body.data.students).toEqual([]);

    for (const path of ["/mentors", "/mentors/1004/students", "/students-without-mentor"]) {
      const r = await get(base, `/api/jobsync/users/${STUDENT}${path}`);
      expect(Object.values(r.body.data)[0]).toEqual([]);
    }
    expect((await get(base, `/api/jobsync/users/${STUDENT}/mentor`)).body.data).toEqual({ mentor: null });
  });

  it("an excluded, unknown or malformed viewer or mentor id → an empty answer with 200, never 404", async () => {
    const { base } = await start();
    for (const viewer of [EXCLUDED, 999999, "abc", "0", "-5", "1e3", "99999999999999999999"]) {
      expect(answer(await get(base, `/api/jobsync/users/${viewer}/mentors`))).toEqual(examples.noMentors);
      expect(answer(await get(base, `/api/jobsync/users/${viewer}/mentors/1004/students`))).toEqual(examples.noStudents);
      expect(answer(await get(base, `/api/jobsync/users/${viewer}/students-without-mentor`))).toEqual(examples.noStudents);
      expect(answer(await get(base, `/api/jobsync/users/${viewer}/mentor`))).toEqual(examples.notAMentor);
    }
    for (const mentor of ["abc", "0", "-5", "999999"]) {
      expect(answer(await get(base, `/api/jobsync/users/${ADMIN}/mentors/${mentor}/students`))).toEqual(examples.noStudents);
    }
  });

  it("a missing or wrong secret → 401; no secret configured → 503", async () => {
    const { base } = await start();
    for (const path of ["/mentors", "/mentor", "/students-without-mentor", "/mentors/1004/students"]) {
      expect(answer(await get(base, `/api/jobsync/users/${ADMIN}${path}`, null))).toEqual(examples.wrongSecret);
      expect(answer(await get(base, `/api/jobsync/users/${ADMIN}${path}`, "wrong-secret"))).toEqual(examples.wrongSecret);
    }
    const unconfigured = await start({ secret: undefined });
    expect(answer(await get(unconfigured.base, `/api/jobsync/users/${ADMIN}/mentors`))).toEqual(examples.noSecretConfigured);
  });
});

describe("the app's client", () => {
  const connect = async () => {
    const { base, stub } = await start();
    vi.stubEnv("SKILLKLAN_API_URL", base);
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
    return stub;
  };

  it("reads each answer for the viewer", async () => {
    await connect();
    expect((await listMentors(ADMIN))?.map((m) => m.name)).toEqual(["Test Mentor", "Test Admin"]);
    expect((await listMentors(QA))?.map((m) => m.direction)).toEqual(["QA"]);
    expect(ids(await listMentorStudents(ADMIN, 1004))).toEqual([1001, 1006]);
    expect(ids(await listStudentsWithoutMentor(ADMIN))).toEqual([1008, 1009]);
    expect(await getViewerMentor(MENTOR)).toEqual({ mentorId: 1004, name: "Test Mentor", direction: "QA" });
    expect(await getViewerMentor(STUDENT)).toBeNull();
  });

  it("an empty list is [], a list that could not be loaded is null — never the same", async () => {
    await connect();
    expect(await listMentors(STUDENT)).toEqual([]);
    expect(await listMentorStudents(QA, 1002)).toEqual([]);

    vi.stubEnv("JOBSYNC_API_SECRET", "wrong-secret");
    expect(await listMentors(ADMIN)).toBeNull();
    expect(await listMentorStudents(ADMIN, 1004)).toBeNull();
    expect(await listStudentsWithoutMentor(ADMIN)).toBeNull();
    expect(await getViewerMentor(MENTOR)).toBeNull();
  });

  it("an id that is not a positive integer is not even sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SKILLKLAN_API_URL", "http://backend.invalid");
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
    for (const bad of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(await listMentors(bad)).toBeNull();
      expect(await listMentorStudents(bad, 1)).toBeNull();
      expect(await listMentorStudents(1, bad)).toBeNull();
      expect(await listStudentsWithoutMentor(bad)).toBeNull();
      expect(await getViewerMentor(bad)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a wrong shape is null; entries of the wrong shape are skipped; a missing name is empty", async () => {
    vi.stubEnv("SKILLKLAN_API_URL", "http://backend.invalid");
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
    const reply = (data: unknown) =>
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data, error: null }), { status: 200 })));

    reply({ mentors: "nope" });
    expect(await listMentors(1)).toBeNull();
    reply({});
    expect(await listStudentsWithoutMentor(1)).toBeNull();
    reply({ students: [{ userId: 5, name: "Ok" }, { userId: "7", name: "String id" }, { userId: 0 }, null, { userId: 9 }] });
    expect(await listMentorStudents(1, 2)).toEqual([
      { userId: 5, name: "Ok" },
      { userId: 9, name: "" },
    ]);
    reply({ mentors: [{ mentorId: 3, name: "M" }, { mentorId: -1 }, "x"] });
    expect(await listMentors(1)).toEqual([{ mentorId: 3, name: "M", direction: "" }]);
    reply({ mentor: { mentorId: 0 } });
    expect(await getViewerMentor(1)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    expect(await listMentors(1)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect(await listMentors(1)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await listMentors(1)).toBeNull();
  });
});

describe("the test mentor signs in (D99)", () => {
  it("the code of the test mentor is exchanged for the role mentor; the access check says the same", async () => {
    const { base, stub } = await start();
    vi.stubEnv("SKILLKLAN_API_URL", base);
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
    expect(await exchangeLoginCode(stub.issueCode(MENTOR)!)).toEqual({ userId: MENTOR, role: "mentor", name: "Test Mentor" });
    expect(await getCabinetAccess(MENTOR)).toEqual({ allowed: true, role: "mentor" });
    // an ordinary student does not come in before D48
    expect(await getCabinetAccess(1006)).toEqual({ allowed: false, role: null });
  });
});

describe("the mentor role (D99)", () => {
  it("is a known role and manages nothing", () => {
    expect(isCabinetRole("mentor")).toBe(true);
    expect(managesSkillklanJob("mentor")).toBe(false);
    expect(managesSkillklanJob("admin")).toBe(true);
    expect(isCabinetRole("teacher")).toBe(false);
  });
});
