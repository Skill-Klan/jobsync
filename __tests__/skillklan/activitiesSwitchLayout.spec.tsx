// Requirement — the owner, 2026-10-16: with Activities switched off nothing of
// them is left on screen — including the banner of a running activity the
// layout shows on every page. Pair: switched on, the banner is there.
import { render, screen } from "@testing-library/react";

const flags = vi.hoisted(() => ({ value: { activities: false } }));
const sidebar = vi.hoisted(() => ({ props: null as null | { cabinetUrl?: string | null } }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: async () => ({ id: "u1", name: "A", email: "a@example.invalid" }) }));
vi.mock("@/actions/agentChat.actions", () => ({ getChatConversation: async () => ({ data: [] }) }));
const passthrough = vi.hoisted(() => ({ children }: { children: unknown }) => children);
vi.mock("@/context/ActivityContext", () => ({ ActivityProvider: passthrough }));
vi.mock("@/context/NotificationContext", () => ({ NotificationProvider: passthrough }));
vi.mock("@/components/agent/AgentChatProvider", () => ({
  AgentChatProvider: passthrough,
  useAgentChat: () => ({ isOpen: false, panelWidth: 0, isResizing: false }),
}));
vi.mock("@/components/agent/AgentChatPanel", () => ({ AgentChatPanel: () => null }));
vi.mock("@/components/Sidebar", () => ({
  default: (props: { cabinetUrl?: string | null }) => {
    sidebar.props = props;
    return null;
  },
}));
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/components/activities/GlobalActivityBanner", () => ({
  GlobalActivityBanner: () => <div data-testid="activity-banner" />,
}));

import RootLayout from "@/app/dashboard/layout";

it.each([
  [false, false],
  [true, true],
])("Activities %s → the running-activity banner shown: %s", async (activities, shown) => {
  flags.value = { activities };
  render(await RootLayout({ children: <p>page</p> }));
  expect(screen.getByText("page")).toBeInTheDocument();
  if (shown) expect(screen.getByTestId("activity-banner")).toBeInTheDocument();
  else expect(screen.queryByTestId("activity-banner")).not.toBeInTheDocument();
});

// Owner 2026-10-18 (D72): «Кабінет» in the side menu — the layout hands it the
// server's CABINET_URL; none set → nothing to link to.
it.each([
  ["https://app.skillklan.com.ua", "https://app.skillklan.com.ua/"],
  [undefined, null],
])("CABINET_URL %j → the side menu gets the cabinet's address %j", async (raw, expected) => {
  if (raw) process.env.CABINET_URL = raw;
  else delete process.env.CABINET_URL;
  render(await RootLayout({ children: <p>page</p> }));
  expect(sidebar.props?.cabinetUrl).toBe(expected);
  delete process.env.CABINET_URL;
});
