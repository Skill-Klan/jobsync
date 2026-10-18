// Requirement — the owner, 2026-10-18 (D73): Automations behind a switch "on
// the same principle" as Activities — with it off, a page opened before the
// switch went off still has its buttons, so the server refuses every change to
// automations and what they found — create, edit, delete, pause, resume,
// accept, dismiss, clear, analyze, delete a run — and touches nothing. D75:
// notifications go with Automations, so every change to them is refused too.
// The answer tells the person to reload.
//
// The switch is keyed: off here means Automations off while Activities and the
// Library are on; the pair turns Automations on and the other two off.
import {
  acceptDiscoveredJob,
  analyzeDiscoveredJob,
  clearDiscoveredJobs,
  createAutomation,
  deleteAutomation,
  deleteAutomationRun,
  dismissDiscoveredJob,
  pauseAutomation,
  resumeAutomation,
  updateAutomation,
} from "@/actions/automation.actions";
import {
  clearReadNotifications,
  deleteNotification,
  dismissAllNotifications,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notification.actions";
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

vi.mock("@/skillklan/featureFlags", () => ({
  isFeatureOff: vi.fn(async (key: string) => flags.off.has(key)),
}));
vi.mock("@/lib/db", () => ({ default: db.client }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const AUTOMATIONS_OFF = { success: false, message: "Automations are switched off. Reload the page." };
const NOTIFICATIONS_OFF = {
  success: false,
  message: "Notifications are switched off together with automations. Reload the page.",
};

const automation = {
  name: "QA Kyiv",
  jobBoard: "greenhouse",
  keywords: "",
  location: "",
  sourceConfig: { greenhouse: { companies: [{ name: "Acme", token: "acme" }] } },
  resumeId: "11111111-1111-4111-8111-111111111111",
  matchThreshold: 80,
  scheduleHour: 8,
};

const automationCalls: [string, () => Promise<unknown>][] = [
  ["create an automation", () => createAutomation(automation as never)],
  ["edit an automation", () => updateAutomation("auto-1", automation as never)],
  ["delete an automation", () => deleteAutomation("auto-1")],
  ["pause an automation", () => pauseAutomation("auto-1")],
  ["resume an automation", () => resumeAutomation("auto-1")],
  ["accept a found job", () => acceptDiscoveredJob("job-1")],
  ["dismiss a found job", () => dismissDiscoveredJob("job-1")],
  ["clear found jobs", () => clearDiscoveredJobs({ automationId: "auto-1", includeNew: true })],
  ["analyze a found job", () => analyzeDiscoveredJob("job-1")],
  ["delete a run from the history", () => deleteAutomationRun("run-1")],
];

const notificationCalls: [string, () => Promise<unknown>][] = [
  ["mark one read", () => markNotificationRead("n-1")],
  ["mark all read", () => markAllNotificationsRead()],
  ["dismiss one", () => dismissNotification("n-1")],
  ["dismiss all", () => dismissAllNotifications()],
  ["delete one", () => deleteNotification("n-1")],
  ["clear the read ones", () => clearReadNotifications()],
];

beforeEach(() => {
  db.calls.length = 0;
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-id" } as never);
});

describe("Automations switched off (Activities and the Library on)", () => {
  beforeEach(() => {
    flags.off = new Set(["automations"]);
  });

  it.each(automationCalls)("%s → refused with 'reload', the database untouched", async (_label, call) => {
    await expect(call()).resolves.toEqual(AUTOMATIONS_OFF);
    expect(db.calls).toEqual([]);
  });

  it.each(notificationCalls)(
    "notifications: %s → refused with 'reload', the database untouched",
    async (_label, call) => {
      await expect(call()).resolves.toEqual(NOTIFICATIONS_OFF);
      expect(db.calls).toEqual([]);
    },
  );
});

describe("pair: Automations on (Activities and the Library off)", () => {
  beforeEach(() => {
    flags.off = new Set(["activities", "library"]);
  });

  it.each(automationCalls)("%s → goes on to the database as before", async (_label, call) => {
    await expect(call()).resolves.not.toEqual(AUTOMATIONS_OFF);
    expect(db.calls.length).toBeGreaterThan(0);
  });

  it.each(notificationCalls)("notifications: %s → goes on to the database as before", async (_label, call) => {
    await expect(call()).resolves.not.toEqual(NOTIFICATIONS_OFF);
    expect(db.calls.some((c) => c.startsWith("notification."))).toBe(true);
  });
});
