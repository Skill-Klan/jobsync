// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// Settings, the AI chat panel and notifications speak Ukrainian — headings,
// buttons, tabs, empty states, day groups and times — and no English word of
// these screens is left. Times are 24-hour, "today" is "Сьогодні".
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setTestLocale } from "../helpers/i18n";

import Settings from "@/components/settings/SettingsView";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import AiUsageSettings from "@/components/settings/AiUsageSettings";
import { NotificationsContainer } from "@/components/notifications/NotificationsContainer";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AgentChatEmptyState } from "@/components/agent/AgentChatEmptyState";
import { AgentApprovalCard } from "@/components/agent/AgentApprovalCard";
import { AgentResultCard } from "@/components/agent/AgentResultCard";
import { AgentChatTrigger } from "@/components/AgentChatTrigger";
import { getAiUsage } from "@/actions/aiUsage.actions";
import * as notificationActions from "@/actions/notification.actions";
import { useNotifications } from "@/context/NotificationContext";
import type { AiUsageSummary } from "@/models/aiUsage.model";

const getUserSettings = vi.fn();
const getUserApiKeys = vi.fn();

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: () => getUserSettings(),
  updateAiSettings: vi.fn(),
  updateDisplaySettings: vi.fn(),
}));
vi.mock("@/actions/apiKey.actions", () => ({
  getUserApiKeys: () => getUserApiKeys(),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getDefaultOllamaBaseUrl: vi.fn().mockResolvedValue("http://127.0.0.1:11434"),
}));
vi.mock("@/actions/aiUsage.actions", () => ({ getAiUsage: vi.fn() }));
vi.mock("@/actions/notification.actions", () => ({
  getNotificationList: vi.fn(),
  getPopoverNotifications: vi.fn(),
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
  clearReadNotifications: vi.fn().mockResolvedValue({ success: true }),
  dismissNotification: vi.fn().mockResolvedValue({ success: true }),
  dismissAllNotifications: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/context/NotificationContext", () => ({ useNotifications: vi.fn() }));
vi.mock("@/utils/ai.utils", () => ({
  checkOllamaConnection: vi.fn().mockResolvedValue({ isConnected: true }),
}));
vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn(), toastInfo: vi.fn() }));
vi.mock("@/hooks/useTabQueryParam", async () => {
  const { useState } = await import("react");
  return { useTabQueryParam: (_tabs: readonly string[], def: string) => useState(def) };
});
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: any) => (
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(e); }}>{children}</a>
  ),
}));
vi.mock("@nivo/bar", () => ({ ResponsiveBar: () => <div data-testid="daily-chart" /> }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }) }));

const chat = {
  isOpen: false,
  open: vi.fn(),
  close: vi.fn(),
  approvalPending: false,
  refreshPreflight: vi.fn(),
  sendMessage: vi.fn(),
  seedExchange: vi.fn(),
  preflight: { checked: true, ok: true },
};
vi.mock("@/components/agent/AgentChatProvider", () => ({ useAgentChat: () => chat }));

// The words each screen had in English. Word-bounded, so "AI" or "API" in a
// Ukrainian label does not count.
const ENGLISH =
  /\b(Settings|Save|Cancel|Delete|Loading|Model|Appearance|Not configured|Add Key|Today|Yesterday|Earlier|Unread|Errors|Runs|Mark all read|Clear (read|all)|Load more|Notifications|Needs approval|Confirm|Company|Job title|Cancelled|Review resume|Match a job|Total tokens|Failures|Recent calls|Timed out|AM|PM)\b/;

beforeEach(() => {
  setTestLocale("uk");
  getUserSettings.mockResolvedValue({
    success: true,
    data: { userId: "u1", settings: { ai: { provider: "openai", model: "gpt-4o" }, display: {} } },
  });
  getUserApiKeys.mockResolvedValue({ success: true, data: [] });
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ data: [{ id: "gpt-4o" }] }) }),
  ) as unknown as typeof fetch;
});

describe("Settings in Ukrainian", () => {
  it("the page, its sections and the AI provider form", async () => {
    const { container } = render(<Settings features={null} />);
    expect(await screen.findByRole("button", { name: "Зберегти" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Налаштування" })).toBeInTheDocument();
    for (const section of ["AI-провайдер", "Використання AI", "API-ключі", "Вигляд", "Дані"]) {
      expect(screen.getByRole("button", { name: section })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "AI-провайдер" })).toBeInTheDocument();
    expect(screen.getByText("Модель")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("«Функції» (admins only): the section and its three switches in Ukrainian, in menu order", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Settings features={{ automations: false, activities: false, library: false }} />,
    );
    await user.click(screen.getByRole("button", { name: "Функції" }));
    expect(screen.getByRole("heading", { name: "Функції" })).toBeInTheDocument();
    // D73: Automations and the Library join Activities.
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    for (const name of ["Автопошук", "Активності", "Довідники"]) {
      expect(screen.getByRole("switch", { name })).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("API keys: every provider unconfigured, with a Ukrainian description", async () => {
    const { container } = render(<ApiKeySettings />);
    expect(await screen.findByRole("heading", { name: "API-ключі" })).toBeInTheDocument();
    expect(screen.getAllByText("Не налаштовано").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Додати ключ" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Адреса вашого сервера Ollama")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });
});

const usage = (): AiUsageSummary => ({
  rangeDays: 30,
  totals: {
    inputTokens: 3_020_000, outputTokens: 630_000, calls: 837, previousCalls: 747, failures: 13,
    stopped: 5, medianMs: 8400, p95Ms: 41200, medianFirstTokenMs: 1900,
  },
  failuresByStatus: { error: 7, truncated: 3, interrupted: 2, timed_out: 1 },
  days: [{ date: "2026-09-28", tokensByProvider: { ollama: 1000 } }],
  providers: [{
    provider: "ollama", tokens: 1_840_000, calls: 412,
    models: [{ model: "qwen3.5:9b", tokens: 1_840_000, calls: 412, medianMs: 14200, p95Ms: 58000, medianFirstTokenMs: 3100, nearContextLimit: 9 }],
  }],
  features: [{ feature: "agent_chat", tokens: 1_280_000, calls: 318, medianMs: 6100 }],
  recent: [{
    id: "c1", startedAt: new Date(2026, 9, 14, 14, 32), feature: "resume_review", provider: "ollama",
    model: "qwen3.5:9b", status: "timed_out", inputTokens: 7950, outputTokens: null, durationMs: 180000, firstTokenMs: 3900,
  }],
});

describe("AI usage in Ukrainian", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 18, 0));
    (getAiUsage as any).mockResolvedValue({ success: true, data: usage() });
  });
  afterEach(() => vi.useRealTimers());

  it("cards, tables and a call made today at 14:32", async () => {
    const { container } = render(<AiUsageSettings />);
    expect(await screen.findByText("Усього токенів")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Використання AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 днів" })).toBeInTheDocument();
    expect(screen.getByText("Невдалі виклики")).toBeInTheDocument();
    expect(screen.getByText("Помилка провайдера")).toBeInTheDocument();
    expect(screen.getByText("Останні виклики")).toBeInTheDocument();
    expect(screen.getByText("Сьогодні 14:32")).toBeInTheDocument();
    expect(screen.getByText("Перевірка резюме")).toBeInTheDocument();
    expect(screen.getByText("8,4 с")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });
});

const now = new Date();
const at1505 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 5);
const old = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
const run = {
  id: "r1", kind: "run", occurrences: 1, occurredAt: at1505, createdAt: at1505, readAt: null, dismissedAt: null,
  automation: { id: "a-1", name: "Remote Frontend" },
  payload: { status: "completed", jobsSearched: 38, jobsSaved: 12, belowThreshold: 0, boardsFailed: 0, aiError: null },
};
const board = {
  ...run, id: "b1", kind: "board", occurredAt: old, createdAt: old, readAt: old, dismissedAt: old,
  automation: { id: "a-2", name: "Backend EU" },
  payload: { provider: "Greenhouse", token: "northwind", companyName: "Northwind", code: "not_found", reason: "Board 'northwind' returned 404" },
};

describe("Notifications in Ukrainian", () => {
  beforeEach(() => {
    (useNotifications as any).mockReturnValue({ summary: { unread: 1, unreadErrors: 0 }, refresh: vi.fn() });
  });

  it("the page: tabs, day groups, a run row with a 24-hour time", () => {
    const { container } = render(
      <NotificationsContainer
        initial={{ items: [run, board] as any, total: 2, counts: { all: 2, unread: 1, errors: 1, runs: 1 } }}
        automations={[{ id: "a-1", name: "Remote Frontend" }]}
      />,
    );
    expect(screen.getByText("Сповіщення")).toBeInTheDocument();
    for (const tab of [/Усі\s*2/, /Непрочитані\s*1/, /Помилки\s*1/, /Запуски\s*1/]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Позначити все прочитаним/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Очистити прочитані/ })).toBeInTheDocument();
    expect(screen.getByText("Сьогодні")).toBeInTheDocument();
    expect(screen.getByText("Раніше")).toBeInTheDocument();
    expect(screen.getByText("Автопошук «Remote Frontend» завершено")).toBeInTheDocument();
    expect(screen.getByText("Збережено 12 вакансій")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Переглянути 12 нових вакансій" })).toBeInTheDocument();
    expect(screen.getByText("Дошка вакансій недоступна")).toBeInTheDocument();
    expect(screen.getAllByText("15:05").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("the bell: an empty popover", async () => {
    (notificationActions.getPopoverNotifications as any).mockResolvedValue({ success: true, data: [] });
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: "Сповіщення" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Нових сповіщень немає.")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Сповіщення" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Переглянути всі сповіщення" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Усі" })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(ENGLISH);
  });
});

describe("AI chat panel in Ukrainian", () => {
  it("the trigger and the empty chat with its suggestions", () => {
    const { container } = render(
      <>
        <AgentChatTrigger />
        <AgentChatEmptyState />
      </>,
    );
    expect(screen.getByRole("button", { name: "Відкрити асистента" })).toHaveTextContent("AI-чат");
    for (const chip of ["Додати вакансію", "Перевірити резюме", "Оцінити відповідність", "Написати супровідний лист"]) {
      expect(screen.getByRole("button", { name: chip })).toBeInTheDocument();
    }
    expect(container.textContent).toMatch(/^AI-чат\s*Я можу додати вакансію/);
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("the approval card for a new job, and a declined result", () => {
    const part = {
      type: "tool-add_job", toolCallId: "c1", state: "approval-requested", approval: { id: "ap1" },
      input: { company: "Acme Corp", jobTitle: "Senior Platform Engineer", location: "Remote" },
    } as any;
    const { container } = render(
      <>
        <AgentApprovalCard part={part} onRespond={vi.fn()} />
        <AgentResultCard part={{ ...part, state: "output-denied" }} />
      </>,
    );
    expect(screen.getByText("Потрібне підтвердження")).toBeInTheDocument();
    expect(screen.getByText("Додати вакансію")).toBeInTheDocument();
    expect(screen.getByText("Компанія")).toBeInTheDocument();
    expect(screen.getByText("Посада")).toBeInTheDocument();
    expect(screen.getByText("Локація")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Підтвердити" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(screen.getByText("Скасовано — нічого не збережено.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b(add_job|Needs approval|Confirm|Cancel|Company|Job title|Location|Cancelled)\b/);
  });
});

describe("the English switch still reads as before", () => {
  it("settings page title and a notification row", async () => {
    setTestLocale("en");
    (useNotifications as any).mockReturnValue({ summary: { unread: 1, unreadErrors: 0 }, refresh: vi.fn() });
    render(<Settings features={null} />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument());
  });
});
