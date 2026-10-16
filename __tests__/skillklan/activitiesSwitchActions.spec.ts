// Requirement — the owner, 2026-10-16: "close this too". With Activities
// switched off, a page opened before the switch went off still has its
// buttons; the server must refuse every change to activities from it — add,
// delete, start, stop, start / end / change a break, start from a task — and
// write nothing. The answer tells the person to reload. Pair: switched on, the
// same calls reach the database as before.
//
// Activity types are not part of this: Tasks group by them too.
import { PrismaClient } from "@prisma/client";
import {
  createActivity,
  deleteActivityById,
  endBreak,
  startActivityById,
  startBreak,
  stopActivityById,
  updateBreakLength,
} from "@/actions/activity.actions";
import { startActivityFromTask } from "@/actions/task.actions";
import { getCurrentUser } from "@/utils/user.utils";

const state = vi.hoisted(() => ({ off: true }));

vi.mock("@/skillklan/featureFlags", () => ({ isFeatureOff: vi.fn(async () => state.off) }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@prisma/client", () => {
  const model = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });
  const client = { activity: model(), task: model(), activityBreak: model() };
  return { PrismaClient: vi.fn(function () { return client; }) };
});

const prisma = new PrismaClient() as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const WRITES = ["create", "update", "delete", "deleteMany"];
const writes = () =>
  Object.values(prisma).flatMap((m) => WRITES.flatMap((w) => m[w].mock.calls));
const reads = () =>
  Object.values(prisma).flatMap((m) => ["findFirst", "findMany", "findUnique"].flatMap((r) => m[r].mock.calls));

const SWITCHED_OFF = { success: false, message: "Activities are switched off. Reload the page." };

const calls: [string, () => Promise<unknown>][] = [
  ["add an activity", () =>
    createActivity({
      activityName: "Пошук",
      activityType: "type-1",
      startDate: new Date("2026-10-16T09:00:00Z"),
      startTime: "09:00",
      endDate: new Date("2026-10-16T10:00:00Z"),
      endTime: "10:00",
      duration: 60,
    } as never)],
  ["delete an activity", () => deleteActivityById("act-1")],
  ["start an activity", () => startActivityById("act-1")],
  ["stop the running activity", () => stopActivityById("act-1", new Date())],
  ["start a break", () => startBreak("act-1", 15)],
  ["end a break", () => endBreak("act-1")],
  ["change the break length", () => updateBreakLength("act-1", 20)],
  ["start an activity from a task", () => startActivityFromTask("task-1")],
];

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-id" });
});

describe("Activities switched off", () => {
  beforeEach(() => {
    state.off = true;
  });

  it.each(calls)("%s → refused with 'reload', nothing read or written", async (_label, call) => {
    await expect(call()).resolves.toEqual(SWITCHED_OFF);
    expect(writes()).toEqual([]);
    expect(reads()).toEqual([]);
  });
});

describe("pair: Activities on", () => {
  beforeEach(() => {
    state.off = false;
  });

  it.each(calls)("%s → goes on to the database as before", async (_label, call) => {
    await call();
    expect(reads().length + writes().length).toBeGreaterThan(0);
  });
});
