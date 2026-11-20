// Requirement — the owner, 2026-11-20: signed in as the admin from a phone,
// there was no way to «Налаштування» (and so to «Функції»): on a phone the side
// menu is hidden, and the user menu (avatar → Settings, language, sign out) lives
// only there. «Так, додай зараз»: the phone menu (☰) carries Settings, the
// language and sign out too — the same three the avatar menu has on a computer.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setLocale = vi.hoisted(() => vi.fn(async (_locale: string) => {}));
vi.mock("@/i18n/actions", () => ({ setLocale }));
vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => ({ activities: false })) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => true) }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/dashboard/interviews") }));
vi.mock("@/components/SidebarToggle", () => ({ default: () => null }));
vi.mock("@/components/AgentChatTrigger", () => ({ AgentChatTrigger: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import Header from "@/components/Header";
import { setTestLocale } from "../helpers/i18n";

const signOutAction = vi.fn(async () => {});

beforeEach(() => {
  setTestLocale("en");
  setLocale.mockClear();
  signOutAction.mockClear();
});

const openMenu = async () => {
  render(await Header({ signOutAction }));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
  return { user, menu: screen.getByRole("dialog") };
};

it("«Settings» is in the phone menu and goes to the settings page (where «Функції» are)", async () => {
  const { menu } = await openMenu();
  expect(within(menu).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/dashboard/settings");
});

it("in Ukrainian it says «Налаштування»", async () => {
  setTestLocale("uk");
  render(await Header({ signOutAction }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Відкрити меню" }));
  expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Налаштування" })).toHaveAttribute("href", "/dashboard/settings");
});

it("the language can be switched from the phone menu; the current one is marked and not sent again", async () => {
  const { user, menu } = await openMenu();
  const language = within(menu).getByRole("group", { name: "Language" });
  const english = within(language).getByRole("button", { name: "English" });
  const ukrainian = within(language).getByRole("button", { name: "Українська" });
  expect(english).toHaveAttribute("aria-pressed", "true");
  expect(ukrainian).toHaveAttribute("aria-pressed", "false");

  await user.click(english);
  expect(setLocale).not.toHaveBeenCalled();
  await user.click(ukrainian);
  expect(setLocale).toHaveBeenCalledWith("uk");
});

it("«Logout» in the phone menu signs out", async () => {
  const { user, menu } = await openMenu();
  await user.click(within(menu).getByRole("button", { name: "Logout" }));
  expect(signOutAction).toHaveBeenCalledTimes(1);
});
