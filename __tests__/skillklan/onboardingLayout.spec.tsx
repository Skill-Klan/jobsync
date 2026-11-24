// Requirement — the onboarding video (docs/decisions.md D118): the layout makes it open by itself only for a
// person who has not watched it yet, and never for the admin or the QA moderator — it asks onboardingRequired()
// with the signed-in person and whether the session says admin, and hands the answer to the provider.
import { render } from "@testing-library/react";

const flags = vi.hoisted(() => ({ value: { activities: false } }));
const sidebar = vi.hoisted(() => ({ props: null as null | { cabinetUrl?: string | null; isAdmin?: boolean } }));
const admin = vi.hoisted(() => ({ value: false }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => flags.value) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: async () => admin.value }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: async () => ({ id: "u1", name: "A", email: "a@example.invalid" }) }));
vi.mock("@/actions/agentChat.actions", () => ({ getChatConversation: async () => ({ data: [] }) }));
const required = vi.hoisted(() => ({ fn: vi.fn(async (_userId: string, _isAdmin: boolean) => true) }));
vi.mock("@/skillklan/onboarding/state", () => ({ onboardingRequired: required.fn }));
const provider = vi.hoisted(() => ({ props: null as null | { required: boolean } }));
vi.mock("@/components/onboarding/OnboardingProvider", () => ({
  OnboardingProvider: (props: { required: boolean; children: unknown }) => {
    provider.props = props;
    return props.children;
  },
}));
const passthrough = vi.hoisted(() => ({ children }: { children: unknown }) => children);
vi.mock("@/context/ActivityContext", () => ({ ActivityProvider: passthrough }));
vi.mock("@/context/NotificationContext", () => ({ NotificationProvider: passthrough }));
vi.mock("@/components/agent/AgentChatProvider", () => ({
  AgentChatProvider: passthrough,
  useAgentChat: () => ({ isOpen: false, panelWidth: 0, isResizing: false }),
}));
vi.mock("@/components/agent/AgentChatPanel", () => ({ AgentChatPanel: () => null }));
vi.mock("@/components/Sidebar", () => ({
  default: (props: { cabinetUrl?: string | null; isAdmin?: boolean }) => {
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
  [false, true, true],
  [false, false, false],
  [true, false, false],
])("admin %s, not watched yet %s → the video must open: %s", async (isAdmin, notWatched, expected) => {
  admin.value = isAdmin;
  required.fn.mockImplementation(async (_userId, asAdmin) => !asAdmin && notWatched);
  render(await RootLayout({ children: null }));
  expect(required.fn).toHaveBeenCalledWith("u1", isAdmin);
  expect(provider.props?.required).toBe(expected);
});
