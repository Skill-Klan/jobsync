// Requirement — D29 (Ukrainian by default, English on a switch) and D30 (the
// glossary agreed by the owner, kept in the team notes): the menu, the
// user menu and the sign-in page speak Ukrainian with exactly these words; the
// user menu offers both languages and stores the choice.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import CabinetSignin from "@/components/auth/CabinetSignin";
import { SidebarProvider } from "@/context/SidebarContext";
import { useNotifications } from "@/context/NotificationContext";
import { setLocale } from "@/i18n/actions";
import { setTestLocale } from "../helpers/i18n";

vi.mock("next/navigation", () => ({ usePathname: vi.fn().mockReturnValue("/dashboard") }));
vi.mock("@/context/NotificationContext", () => ({ useNotifications: vi.fn() }));
vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn(async () => true) }));

beforeEach(() => {
  (useNotifications as any).mockReturnValue({ summary: { unread: 0, unreadErrors: 0 }, refresh: vi.fn() });
});

const renderSidebar = () =>
  render(
    <SidebarProvider initialExpanded>
      <Sidebar user={{ id: "1", name: "Тест", email: "t@example.invalid" }} signOutAction={() => {}} />
    </SidebarProvider>,
  );

describe("menu in Ukrainian (glossary D30)", () => {
  it("every item uses the agreed word, no English left", () => {
    setTestLocale("uk");
    renderSidebar();
    const nav = screen.getByRole("navigation");
    const labels = within(nav).getAllByRole("link").map((a) => a.textContent?.trim());
    expect(labels).toEqual([
      "Головна", "Вакансії", "Співбесіди", "Автопошук", "Завдання", "Активності", "Питання", "Профіль", "Довідники",
    ]);
  });

  it("in English — the same items in English", () => {
    renderSidebar();
    const labels = within(screen.getByRole("navigation")).getAllByRole("link").map((a) => a.textContent?.trim());
    expect(labels).toEqual(["Dashboard", "Jobs", "Interviews", "Automations", "Tasks", "Activities", "Questions", "Profile", "Library"]);
  });
});

describe("user menu", () => {
  it("in Ukrainian, with both languages and the current one checked", async () => {
    setTestLocale("uk");
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "Меню користувача" }));

    expect(screen.getByRole("menuitem", { name: /налаштування/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /сповіщення/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /підтримка/i })).toBeInTheDocument();
    expect(screen.getByText("Мова")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Українська" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "English" })).toHaveAttribute("aria-checked", "false");
  });

  it("choosing English stores English", async () => {
    setTestLocale("uk");
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "Меню користувача" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(setLocale).toHaveBeenCalledWith("en");
  });

  it("choosing the language already in use stores nothing", async () => {
    setTestLocale("uk");
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "Меню користувача" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Українська" }));
    expect(setLocale).not.toHaveBeenCalled();
  });
});

describe("sign-in page in Ukrainian", () => {
  it("says where to sign in, and says so when it failed", () => {
    setTestLocale("uk");
    render(<CabinetSignin cabinetUrl="https://app.example.invalid" failed />);
    expect(screen.getByRole("heading", { name: "Вхід через кабінет" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося увійти");
    expect(screen.getByRole("link", { name: "Відкрити кабінет" })).toHaveAttribute("href", "https://app.example.invalid");
  });
});
