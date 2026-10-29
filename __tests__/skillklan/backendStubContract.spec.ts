// @vitest-environment node
//
// Requirement: a contributor develops against the local backend (skillklan/dev/backend-stub.mjs), so it must
// answer like the SkillKlan backend — refusals included — or code that "works locally" breaks in production.
// The reference is not the stand-in itself but docs/contracts/examples/backend-login.json, taken from what the
// backend's own API tests assert (an independent source):
//   S1  exchange: only { userId, role, name } in the envelope, no-store; the same code twice → 401 JOBSYNC_CODE_INVALID
//   S2  an invented, malformed, missing or non-string code → the very same answer as a used one
//   S3  no secret configured → 503; a missing or wrong secret → 401, and the code is not spent
//   S4  the person lost access after the code was issued → 403 JOBSYNC_ACCESS_DENIED, and the code is spent
//   S5  a code older than 60 s → 401 JOBSYNC_CODE_INVALID; a new code for the same person kills the old one
//   A1  access: student, admin, QA moderator → allowed with their role; mentor, excluded, unknown and malformed
//       ids → 200 { allowed: false, role: null } — never 404
//   A2  access with a missing or wrong secret → 401; no secret configured → 503
//   C1  the app's real client (src/skillklan/cabinetApi.ts) agrees with it: signs in, reads roles, refuses
import type { AddressInfo } from "node:net";
import examples from "../../docs/contracts/examples/backend-login.json";
import { CODE_TTL_MS, createBackendStub } from "../../skillklan/dev/backend-stub.mjs";
import { exchangeLoginCode, getCabinetAccess } from "@/skillklan/cabinetApi";

const SECRET = "local-test-secret-0123456789abcdef";
const STUDENT = 1001;
const ADMIN = 1002;
const QA_MODERATOR = 1003;

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
});

async function exchange(base: string, body: unknown, secret: string | null = SECRET) {
  const res = await fetch(`${base}/api/jobsync/login-code/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-jobsync-secret": secret }) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), cacheControl: res.headers.get("cache-control") };
}

async function access(base: string, id: string | number, secret: string | null = SECRET) {
  const res = await fetch(`${base}/api/jobsync/users/${id}/access`, {
    headers: secret === null ? {} : { "x-jobsync-secret": secret },
  });
  return { status: res.status, body: await res.json(), cacheControl: res.headers.get("cache-control") };
}

const answer = (r: { status: number; body: unknown }) => ({ status: r.status, body: r.body });

describe("S exchange of the one-time code", () => {
  it("S1 gives only id, role and name, not cached; the same code twice is refused", async () => {
    const { stub, base } = await start();
    const code = stub.issueCode(STUDENT)!;

    const first = await exchange(base, { code });
    expect(answer(first)).toEqual(examples.exchange.ok);
    expect(first.cacheControl).toBe("no-store");

    expect(answer(await exchange(base, { code }))).toEqual(examples.exchange.codeInvalid);
  });

  it("S2 an invented, malformed, missing or non-string code is the same 401 as a used one", async () => {
    const { base } = await start();
    for (const body of [{ code: "A".repeat(43) }, { code: "abc" }, {}, { code: 42 }, null]) {
      expect(answer(await exchange(base, body))).toEqual(examples.exchange.codeInvalid);
    }
  });

  it("S3 no secret configured → 503; missing or wrong secret → 401 and the code still works", async () => {
    const unconfigured = await start({ secret: undefined });
    const blind = unconfigured.stub.issueCode(STUDENT)!;
    expect(answer(await exchange(unconfigured.base, { code: blind }))).toEqual(examples.exchange.noSecretConfigured);

    const { stub, base } = await start();
    const code = stub.issueCode(STUDENT)!;
    expect(answer(await exchange(base, { code }, null))).toEqual(examples.exchange.wrongSecret);
    expect(answer(await exchange(base, { code }, "wrong-secret"))).toEqual(examples.exchange.wrongSecret);
    expect((await exchange(base, { code })).status).toBe(200);
  });

  it("S4 access lost after the code was issued → 403, and the code is spent", async () => {
    const { stub, base } = await start();
    const code = stub.issueCode(STUDENT)!;
    stub.setActive(STUDENT, false);

    expect(answer(await exchange(base, { code }))).toEqual(examples.exchange.accessDenied);
    stub.setActive(STUDENT, true);
    expect(answer(await exchange(base, { code }))).toEqual(examples.exchange.codeInvalid);
  });

  it("S5 a code lives 60 s, and a new one for the same person replaces it", async () => {
    let clock = 1_000_000;
    const { stub, base } = await start({ secret: SECRET, now: () => clock });

    const expired = stub.issueCode(STUDENT)!;
    clock += CODE_TTL_MS;
    expect(answer(await exchange(base, { code: expired }))).toEqual(examples.exchange.codeInvalid);

    const older = stub.issueCode(STUDENT)!;
    const newer = stub.issueCode(STUDENT)!;
    expect(answer(await exchange(base, { code: older }))).toEqual(examples.exchange.codeInvalid);
    expect((await exchange(base, { code: newer })).status).toBe(200);
  });

  it("nobody outside the three roles or excluded gets a code from the cabinet", async () => {
    const { stub } = await start();
    expect(stub.issueCode(1004)).toBeNull(); // mentor
    expect(stub.issueCode(1005)).toBeNull(); // excluded student
    expect(stub.issueCode(999999)).toBeNull();
    expect(stub.issueCode(QA_MODERATOR)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("A access check", () => {
  it("A1 the three roles are allowed with their role; anyone else is { allowed: false } with 200", async () => {
    const { base } = await start();
    const admin = await access(base, ADMIN);
    expect(answer(admin)).toEqual(examples.access.allowed);
    expect(admin.cacheControl).toBe("no-store");
    expect((await access(base, STUDENT)).body.data).toEqual({ allowed: true, role: "student" });
    expect((await access(base, QA_MODERATOR)).body.data).toEqual({ allowed: true, role: "qa_moderator" });

    for (const id of [1004, 1005, 999999, "abc", "0", "-5", "1e3", "99999999999999999999"]) {
      expect(answer(await access(base, id))).toEqual(examples.access.notAllowed);
    }
  });

  it("A2 missing or wrong secret → 401; no secret configured → 503", async () => {
    const { base } = await start();
    expect(answer(await access(base, STUDENT, null))).toEqual(examples.access.wrongSecret);
    expect(answer(await access(base, STUDENT, "wrong-secret"))).toEqual(examples.access.wrongSecret);

    const unconfigured = await start({ secret: undefined });
    expect(answer(await access(unconfigured.base, STUDENT))).toEqual(examples.access.noSecretConfigured);
  });
});

describe("C the app's client against the local backend", () => {
  it("C1 signs in, reads the role, follows exclusion, refuses on a wrong secret", async () => {
    const { stub, base } = await start();
    vi.stubEnv("SKILLKLAN_API_URL", base);
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);

    expect(await exchangeLoginCode(stub.issueCode(STUDENT)!)).toEqual({
      userId: STUDENT,
      role: "student",
      name: "Test Student",
    });
    expect(await getCabinetAccess(QA_MODERATOR)).toEqual({ allowed: true, role: "qa_moderator" });

    stub.setActive(ADMIN, false);
    expect(await getCabinetAccess(ADMIN)).toEqual({ allowed: false, role: null });

    const code = stub.issueCode(QA_MODERATOR)!;
    vi.stubEnv("JOBSYNC_API_SECRET", "wrong-secret");
    expect(await exchangeLoginCode(code)).toBeNull();
    vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
    expect(await exchangeLoginCode(code)).toMatchObject({ userId: QA_MODERATOR, role: "qa_moderator" });
  });
});
