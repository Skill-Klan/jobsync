// Requirement — the owner, 2026-10-18 (D73): the Library («Довідники») behind a
// switch "on the same principle" as Activities. With it off, a page opened
// before the switch went off still has its buttons, so the server refuses
// every change only the Library makes — edit or delete a company, watch a
// board, delete a contact, a title, a location, a source, a skill, a role, an
// activity type, add / edit / delete a vacancy stage — and touches nothing.
// The answer tells the person to reload.
//
// Not refused: what forms create on the fly (a company, a skill, a role, a
// job title, an activity type typed into a form) — the lists keep filling up
// while the Library is hidden (Settings → «Функції», the switch's text).
//
// The switch is keyed: off here means the Library off while Automations and
// Activities are on; the pair turns the Library on and the other two off.
import {
  addCompany,
  deleteCompanyById,
  setCompanyWatched,
  updateCompany,
  watchBoardCompany,
} from "@/actions/company.actions";
import { deleteContactById } from "@/actions/contact.actions";
import { createActivityType, deleteActivityTypeById } from "@/actions/activity.actions";
import { createTag, deleteTagById } from "@/actions/tag.actions";
import { createJobTitle, deleteJobTitleById } from "@/actions/jobtitle.actions";
import { deleteJobSourceById } from "@/actions/jobSource.actions";
import { deleteJobLocationById } from "@/actions/jobLocation.actions";
import { createContactRole, deleteContactRoleById } from "@/actions/contactRole.actions";
import {
  createJobStageType,
  deleteJobStageTypeById,
  updateJobStageType,
} from "@/actions/jobStageType.actions";
import { getCurrentUser } from "@/utils/user.utils";

const flags = vi.hoisted(() => ({ off: new Set<string>() }));
// Every database call is recorded as "model.method"; reads find nothing.
const db = vi.hoisted(() => {
  const calls: string[] = [];
  const answer = (method: string) =>
    method === "count" ? 0 : method === "findMany" ? [] : null;
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method) =>
          typeof method === "string" && method !== "then"
            ? async () => {
                calls.push(`${name}.${method}`);
                return answer(method);
              }
            : undefined,
      },
    );
  const client = new Proxy(
    {},
    { get: (_t, name) => (typeof name === "string" && name !== "then" ? model(name) : undefined) },
  );
  return { calls, client };
});
const resolve = vi.hoisted(() => ({
  resolveTag: vi.fn(async () => ({ id: "t-1", label: "QA", value: "qa", created: true })),
  resolveContactRole: vi.fn(async () => ({ id: "r-1", label: "HR", value: "hr" })),
  resolveJobStageType: vi.fn(async () => ({ id: "st-1" })),
}));

vi.mock("@/skillklan/featureFlags", () => ({
  isFeatureOff: vi.fn(async (key: string) => flags.off.has(key)),
}));
vi.mock("@/lib/db", () => ({ default: db.client }));
vi.mock("@/lib/jobs/resolve", () => resolve);
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const LIBRARY_OFF = { success: false, message: "The Library is switched off. Reload the page." };

const libraryOnly: [string, () => Promise<unknown>][] = [
  ["edit a company", () => updateCompany({ id: "c-1", company: "Acme" } as never)],
  ["delete a company", () => deleteCompanyById("c-1")],
  ["watch a board", () => watchBoardCompany("greenhouse", { name: "Acme", token: "acme" })],
  ["stop watching a company", () => setCompanyWatched("c-1", false)],
  ["delete a contact", () => deleteContactById("ct-1")],
  ["delete an activity type", () => deleteActivityTypeById("at-1")],
  ["delete a skill", () => deleteTagById("t-1")],
  ["delete a job title", () => deleteJobTitleById("jt-1")],
  ["delete a source", () => deleteJobSourceById("js-1")],
  ["delete a location", () => deleteJobLocationById("l-1")],
  ["delete a contact role", () => deleteContactRoleById("r-1")],
  ["add a vacancy stage", () => createJobStageType("Технічна", "status-1")],
  ["edit a vacancy stage", () => updateJobStageType("st-1", "Технічна", "status-1", 1)],
  ["delete a vacancy stage", () => deleteJobStageTypeById("st-1")],
];

const fromForms: [string, () => Promise<unknown>][] = [
  ["a company typed into a form", () => addCompany({ company: "Acme" } as never)],
  ["a skill", () => createTag("Selenium")],
  ["a contact role", () => createContactRole("HR")],
  ["a job title", () => createJobTitle("QA Engineer")],
  ["an activity type", () => createActivityType("Співбесіда")],
];

beforeEach(() => {
  db.calls.length = 0;
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-id" } as never);
});

describe("the Library switched off (Automations and Activities on)", () => {
  beforeEach(() => {
    flags.off = new Set(["library"]);
  });

  it.each(libraryOnly)("%s → refused with 'reload', the database untouched", async (_label, call) => {
    await expect(call()).resolves.toEqual(LIBRARY_OFF);
    expect(db.calls).toEqual([]);
  });

  it.each(fromForms)("creating %s from a form still works — not refused", async (_label, call) => {
    const result = await call().catch((error: Error) => error);
    expect(result).not.toEqual(LIBRARY_OFF);
    expect(db.calls.length + resolve.resolveTag.mock.calls.length + resolve.resolveContactRole.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("pair: the Library on (Automations and Activities off)", () => {
  beforeEach(() => {
    flags.off = new Set(["automations", "activities"]);
  });

  it.each(libraryOnly)("%s → goes on as before", async (_label, call) => {
    const result = await call().catch((error: Error) => error);
    expect(result).not.toEqual(LIBRARY_OFF);
    expect(db.calls.length).toBeGreaterThan(0);
  });
});
