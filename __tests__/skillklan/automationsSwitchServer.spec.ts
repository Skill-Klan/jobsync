// @vitest-environment node
// Requirement — the owner, 2026-10-18 (D73, D74): with Automations switched off
// nothing of them runs:
//   · «Запустити зараз», «Скасувати» and «Очистити журнал» from a page opened
//     before the switch went off are refused (403, "reload") and touch nothing;
//   · the scheduler starts no automation — no AI spent, no notifications for a
//     hidden tab — and does not even look for due ones.
// Pairs: switched on, the same requests reach the database and the scheduler
// runs what is due.
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ automations: false }));
const db = vi.hoisted(() => ({
  automation: { findFirst: vi.fn(), findMany: vi.fn() },
  automationRun: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
const scraper = vi.hoisted(() => ({ runAutomation: vi.fn() }));

vi.mock("@/skillklan/featureFlags", () => ({
  isFeatureOff: vi.fn(async (key: string) => key === "automations" && !flags.automations),
  readFeatureFlags: vi.fn(async () => ({
    automations: flags.automations,
    activities: true,
    library: true,
  })),
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user-id" } })) }));
vi.mock("@/lib/scraper", () => ({
  runAutomation: scraper.runAutomation,
  getUserAiSettings: vi.fn(),
  AutomationAlreadyRunningError: class extends Error {},
}));
vi.mock("@/lib/ai/provider-registry.server", () => ({ PROVIDER_VERIFIERS: {} }));
vi.mock("@/actions/apiKey.actions", () => ({ getOllamaBaseUrl: vi.fn() }));
vi.mock("@/lib/notifications/prune", () => ({ pruneNotifications: vi.fn() }));
vi.mock("@/lib/aiUsage/prune", () => ({ pruneAiCalls: vi.fn() }));

import { POST as run } from "@/app/api/automations/[id]/run/route";
import { POST as cancel } from "@/app/api/automations/[id]/cancel/route";
import { POST as clearLogs } from "@/app/api/automations/[id]/logs/clear/route";
import { runDueAutomations } from "@/lib/scheduler";

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const routes: [string, Handler][] = [
  ["run now", run],
  ["cancel the run", cancel],
  ["clear the log", clearLogs],
];
const call = (handler: Handler) =>
  handler(new NextRequest("http://localhost/api/automations/auto-1/x", { method: "POST" }), {
    params: Promise.resolve({ id: "auto-1" }),
  });
const dbCalls = () =>
  Object.values(db).flatMap((model) => Object.values(model).flatMap((fn) => fn.mock.calls));

beforeEach(() => {
  db.automation.findFirst.mockResolvedValue(null);
  db.automation.findMany.mockResolvedValue([]);
});

describe("routes", () => {
  it.each(routes)("Automations off → %s refused: 403 'reload', the database untouched", async (_label, handler) => {
    flags.automations = false;
    const res = await call(handler);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ message: "Automations are switched off. Reload the page." });
    expect(dbCalls()).toEqual([]);
  });

  it.each(routes)("pair: Automations on → %s goes on to the database as before", async (_label, handler) => {
    flags.automations = true;
    const res = await call(handler);
    // No such automation in the fake database — the route's own answer.
    expect(res.status).toBe(404);
    expect(db.automation.findFirst).toHaveBeenCalled();
  });
});

describe("the scheduler", () => {
  const due = {
    id: "auto-1",
    userId: "user-id",
    name: "QA",
    jobBoard: "greenhouse",
    keywords: "",
    location: "",
    sourceConfig: null,
    resumeId: "r-1",
    resume: { id: "r-1" },
    matchThreshold: 80,
    scheduleHour: 8,
    nextRunAt: new Date("2026-10-18T08:00:00Z"),
    lastRunAt: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db.automation.findMany.mockResolvedValue([due]);
    db.automationRun.findFirst.mockResolvedValue(null);
    scraper.runAutomation.mockResolvedValue({ status: "completed", jobsSaved: 0 });
  });

  it("Automations off → runs nothing and does not even look for due automations", async () => {
    flags.automations = false;
    await runDueAutomations();
    expect(db.automation.findMany).not.toHaveBeenCalled();
    expect(scraper.runAutomation).not.toHaveBeenCalled();
  });

  it("pair: Automations on → the due automation runs", async () => {
    flags.automations = true;
    await runDueAutomations();
    expect(scraper.runAutomation).toHaveBeenCalledWith(expect.objectContaining({ id: "auto-1" }));
  });
});
