// Requirement — the onboarding video (docs/decisions.md D118): it can be watched again any time from the menu —
// «Відео-огляд» in the profile menu (as the video itself shows) and the same item in the phone menu, where the
// profile menu is not reachable (src/components/Header.tsx). Picking it opens the person's video; the phone menu
// closes on the same click.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  getOnboardingVideo: vi.fn(async () => ({ success: true, data: { video: "student" } })),
  finishOnboarding: vi.fn(),
}));
vi.mock("@/actions/onboarding.actions", () => actions);
vi.mock("@/context/NotificationContext", () => ({ useNotifications: () => ({ summary: { unread: 0, unreadErrors: 0 } }) }));
vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn(async () => {}) }));
vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => ({ activities: false })) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => false) }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";

const user = { id: "u1", name: "Олена Коваль", email: "cabinet-1@users.jobs.skillklan.invalid" };

it("the profile menu: «Video tour» opens the person's video", async () => {
  const ui = userEvent.setup();
  render(
    <OnboardingProvider required={false}>
      <TooltipProvider>
        <ProfileDropdown user={user} expanded signOutAction={() => {}} />
      </TooltipProvider>
    </OnboardingProvider>,
  );
  await ui.click(screen.getByRole("button", { name: "User menu" }));
  await ui.click(await screen.findByRole("menuitem", { name: "Video tour" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.querySelector("video")).toHaveAttribute("src", "/onboarding/student.mp4");
  expect(actions.getOnboardingVideo).toHaveBeenCalledTimes(1);
});

it("the phone menu: «Video tour» closes the menu and opens the video", async () => {
  const ui = userEvent.setup();
  render(<OnboardingProvider required={false}>{await Header({ signOutAction: async () => {} })}</OnboardingProvider>);
  await ui.click(screen.getByRole("button", { name: "Toggle Menu" }));
  const menu = screen.getByRole("dialog");
  await ui.click(within(menu).getByRole("button", { name: "Video tour" }));
  await waitFor(() => expect(screen.getByRole("dialog").querySelector("video")).toHaveAttribute("src", "/onboarding/student.mp4"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1); // the phone menu is gone
});
