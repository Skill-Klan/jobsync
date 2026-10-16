// Requirement — the owner, 2026-10-16: a «Записи співбесід» tab in «Співбесіди»
// (not a new menu item) where everyone can listen to every recording the bot
// collected — shown as a library, not tied to people, each with the name of
// whoever uploaded it. Listening plays it from Google Drive through this
// server — and only plays it: "there must be no way to download" (no button,
// no "Download" in the player's menu, no "Save audio as"). Until Drive is
// connected the page is exactly as before.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewRecordingsLibrary from "@/components/interviews/InterviewRecordingsLibrary";

const configured = vi.hoisted(() => ({ value: false }));
vi.mock("@/skillklan/interviewRecordings", () => ({ isRecordingsConfigured: () => configured.value }));
vi.mock("@/actions/interview.actions", () => ({ getInterviewFilterOptions: vi.fn(async () => ({ rounds: [], companies: [] })) }));
vi.mock("@/actions/jobStageType.actions", () => ({ getAllJobStageTypes: vi.fn(async () => []) }));
vi.mock("@/actions/job.actions", () => ({ getStatusList: vi.fn(async () => []) }));
vi.mock("@/components/interviews/InterviewsContainer", () => ({ default: () => <div data-testid="my-interviews" /> }));
const nav = vi.hoisted(() => ({ query: new URLSearchParams(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/interviews",
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => nav.query,
}));

import InterviewsPage from "@/app/dashboard/interviews/page";

const RECORDINGS = [
  { id: "fileBaMgr0001", kind: "baManager", mimeType: "audio/mpeg", date: "2026-10-10", specializations: [], person: "Марія Іваненко", company: "Ajax", title: "10.10.2026 - Марія Іваненко - Ajax" },
  { id: "fileQaTech001", kind: "qaTech", mimeType: "audio/mpeg", date: "2026-09-24", specializations: ["Mobile", "API"], person: "Іван Петренко", company: "Monobank", title: "24.09.2026 - Mobile+API - Іван Петренко - Monobank" },
  { id: "fileQaTech002", kind: "qaTech", mimeType: "audio/ogg", date: null, specializations: [], person: null, company: null, title: "voice message" },
];

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  configured.value = false;
  nav.query = new URLSearchParams();
  fetchMock = vi.fn(() => answer(200, { recordings: RECORDINGS }));
  vi.stubGlobal("fetch", fetchMock);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
});

const rows = () => screen.getAllByRole("listitem");

describe("the library", () => {
  it("every recording, newest first: date, kind, specialization, company and the uploader's name", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(fetchMock).toHaveBeenCalledWith("/api/skillklan/interview-recordings", expect.anything());
    const first = within(rows()[1]);
    expect(first.getByText("24.09.2026")).toBeInTheDocument();
    expect(first.getByText("QA · Technical")).toBeInTheDocument();
    expect(first.getByText("Mobile + API")).toBeInTheDocument();
    expect(rows()[1]).toHaveTextContent("Monobank · Іван Петренко");
    // A name the bot did not write — its raw title, no date.
    expect(within(rows()[2]).getByText("No date")).toBeInTheDocument();
    expect(rows()[2]).toHaveTextContent("voice message");
  });

  it("Listen → a player that streams this recording through the server; Close → gone", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(within(rows()[1]).getByRole("button", { name: "Listen" }));
    const player = rows()[1].querySelector("audio")!;
    expect(player).toHaveAttribute("src", "/api/skillklan/interview-recordings/fileQaTech001");
    expect(player).toHaveAttribute("controls");
    // No "Download" in the browser's own player menu, no "Save audio as".
    expect(player).toHaveAttribute("controlslist", "nodownload");
    expect(fireEvent.contextMenu(player)).toBe(false);
    expect(document.querySelectorAll("audio")).toHaveLength(1);
    await user.click(within(rows()[1]).getByRole("button", { name: "Close" }));
    expect(document.querySelectorAll("audio")).toHaveLength(0);
  });

  it("a format the browser cannot play → says so, without offering a download", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(within(rows()[2]).getByRole("button", { name: "Listen" }));
    fireEvent.error(rows()[2].querySelector("audio")!);
    expect(within(rows()[2]).getByText(/can't play this format — try another browser/)).toBeInTheDocument();
  });

  it("no way to download: no link, no download button, nothing with 'download' in the library", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    // No player is open here, so not even the player's "nodownload" is on the page.
    expect(document.body.innerHTML).not.toMatch(/download/i);
  });

  it("search by company, name or specialization", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.type(screen.getByPlaceholderText("Search recordings…"), "іваненко");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Ajax");
    await user.clear(screen.getByPlaceholderText("Search recordings…"));
    await user.type(screen.getByPlaceholderText("Search recordings…"), "api");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Monobank");
  });

  it("filter by interview type", async () => {
    const user = userEvent.setup({ skipHover: true });
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(screen.getByRole("combobox", { name: "Interview type" }));
    await user.click(screen.getByRole("option", { name: "BA · Manager" }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Ajax");
  });

  it("the server could not read Drive → says so; nothing yet → says so", async () => {
    fetchMock.mockImplementationOnce(() => answer(502, { error: "Unavailable" }));
    const { unmount } = render(<InterviewRecordingsLibrary />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the recordings");
    unmount();
    fetchMock.mockImplementationOnce(() => answer(200, { recordings: [] }));
    render(<InterviewRecordingsLibrary />);
    expect(await screen.findByText("No recordings yet.")).toBeInTheDocument();
  });
});

describe("the «Співбесіди» page", () => {
  it("Drive not connected → the page as before: no tabs, the library is not even asked", async () => {
    render(await InterviewsPage());
    expect(screen.getByTestId("my-interviews")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("connected → two tabs, «My interviews» first; the library loads only when its tab is open", async () => {
    configured.value = true;
    const { unmount } = render(await InterviewsPage());
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["My interviews", "Interview recordings"]);
    expect(screen.getByTestId("my-interviews")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();

    nav.query = new URLSearchParams("tab=recordings");
    render(await InterviewsPage());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/skillklan/interview-recordings", expect.anything()));
  });

  it("switching tabs keeps it in the address (a link opens the same tab)", async () => {
    configured.value = true;
    const user = userEvent.setup();
    render(await InterviewsPage());
    await user.click(screen.getByRole("tab", { name: "Interview recordings" }));
    expect(nav.push).toHaveBeenCalledWith("/dashboard/interviews?tab=recordings");
  });
});
