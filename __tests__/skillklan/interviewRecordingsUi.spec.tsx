// Requirement — the owner, 2026-10-16: «Співбесіди» is the recordings library
// and nothing else (no «Мої співбесіди» tab), where everyone can listen to every recording the bot
// collected — shown as a library, not tied to people, each with the name of
// whoever uploaded it. Listening plays it from Google Drive through this
// server — and only plays it: "there must be no way to download" (no button,
// no "Download" in the player's menu, no "Save audio as"). Until Drive is
// connected the page says so.
//
// The owner, 2026-10-18 (D67–D70): first the folders of the companies, the
// recordings inside by stage (recruiter → technical → manager); filters —
// direction, stage, company, search; the filters are kept in the page address
// so a link opens the same selection. The rules themselves (merging spellings,
// counts, the address format) are in recordingsLibrary.spec.ts; here — that
// the page does them.
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

// Shaped like the Drive archive: one company in two spellings, a candidate's
// sub-folder, a company with QA and BA, newest first as the server sends them.
const BY_COMPANY = [
  { id: "raifTech0001", kind: "qaTech", mimeType: "audio/mpeg", date: "2026-10-12", specializations: [], person: "Олена Коваль", company: "RaiffeisenBank", title: "12.10.2026 - Олена Коваль - RaiffeisenBank", folder: null },
  { id: "privBaRec001", kind: "baRecruiter", mimeType: "audio/mpeg", date: "2026-09-18", specializations: [], person: "Дарина Бойко", company: "PrivatBank", title: "18.09.2026 - Дарина Бойко - PrivatBank", folder: null },
  { id: "raifRec00001", kind: "qaRecruiter", mimeType: "audio/mpeg", date: "2026-09-01", specializations: [], person: "Юлія Ткач", company: "Raiffeisen Bank", title: "01.09.2026 - Юлія Ткач - Raiffeisen Bank", folder: null },
  { id: "raifTech0002", kind: "qaTech", mimeType: "audio/mpeg", date: null, specializations: [], person: null, company: "RaiffeisenBank", title: "Олег_Мельник_AQA_ч1", folder: "Олег_Мельник_AQA" },
  { id: "privTech0001", kind: "qaTech", mimeType: "audio/mpeg", date: null, specializations: [], person: null, company: "PrivatBank", title: "Богдан_Руденко_QA", folder: null },
  { id: "ajaxTech0001", kind: "qaTech", mimeType: "audio/mpeg", date: null, specializations: [], person: null, company: "Ajax", title: "Ганна_Мазур_QA", folder: null },
];

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const serve = (recordings: unknown[]) => fetchMock.mockImplementation(() => answer(200, { recordings }));

beforeEach(() => {
  configured.value = false;
  nav.query = new URLSearchParams();
  window.history.replaceState(null, "", "/");
  fetchMock = vi.fn(() => answer(200, { recordings: RECORDINGS }));
  vi.stubGlobal("fetch", fetchMock);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
});

const rows = () => screen.getAllByRole("listitem");
const folderOf = (name: string) => screen.getByRole("region", { name });
const folderButton = (name: string) => within(folderOf(name)).getAllByRole("button")[0];
const params = () => new URLSearchParams(window.location.search);

describe("all recordings — the list", () => {
  beforeEach(() => {
    nav.query = new URLSearchParams("view=all");
  });

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

  // Owner 2026-10-18: the company folders' archive is in the library too; its
  // names are not the bot's — the company comes from the folder, and the name
  // (who, what) must still be seen, not just the company.
  it("an archive recording: its company and its own name", async () => {
    serve([
      { id: "fileEpamOld01", kind: "qaTech", mimeType: "audio/mp4", date: "2025-09-24", specializations: [], person: null, company: "EPAM", title: "Іван_Петренко_QA_24.09.25" },
    ]);
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent("EPAM · Іван_Петренко_QA_24.09.25");
    expect(within(rows()[0]).getByText("24.09.2025")).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("Search…"), "іваненко");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Ajax");
    await user.clear(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "api");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Monobank");
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

describe("by company — the first view (D67, D68)", () => {
  beforeEach(() => serve(BY_COMPANY));

  it("first: the folders of the companies, the most recorded first, closed; one folder for both spellings", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["RaiffeisenBank", "PrivatBank", "Ajax"]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(folderButton("RaiffeisenBank")).toHaveAttribute("aria-expanded", "false");
    expect(folderButton("RaiffeisenBank")).toHaveTextContent("Recruiter 1");
    expect(folderButton("RaiffeisenBank")).toHaveTextContent("Technical 2");
    expect(screen.getByText(/^· 3 companies$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "By company", pressed: true })).toBeInTheDocument();
  });

  it("open a company: recruiter, then technical; a candidate's sub-folder inside its stage; the address remembers it", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(folderButton("RaiffeisenBank"));
    const raif = folderOf("RaiffeisenBank");
    expect(folderButton("RaiffeisenBank")).toHaveAttribute("aria-expanded", "true");
    expect(within(raif).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Recruiter · 1", "Technical · 2"]);
    expect(within(raif).getByText("Олег_Мельник_AQA")).toBeInTheDocument();
    expect(within(raif).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Юлія Ткач"),
      expect.stringContaining("Олена Коваль"),
      expect.stringContaining("Олег_Мельник_AQA_ч1"),
    ]);
    expect(params().get("open")).toBe("raiffeisenbank");
    await user.click(folderButton("RaiffeisenBank"));
    expect(within(folderOf("RaiffeisenBank")).queryAllByRole("listitem")).toHaveLength(0);
    expect(params().get("open")).toBeNull();
  });

  it("inside a company the stage is the heading: no kind badge; QA / BA only where the company has both", async () => {
    nav.query = new URLSearchParams("open=raiffeisenbank,privatbank");
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(within(folderOf("PrivatBank")).getAllByRole("listitem")).toHaveLength(2));
    const priv = within(folderOf("PrivatBank")).getAllByRole("listitem");
    expect(within(priv[0]).getByText("BA")).toBeInTheDocument();
    expect(within(priv[1]).getByText("QA")).toBeInTheDocument();
    // Look for the badge itself: the row's text runs together («12.10.2026QA…»), so a
    // word boundary would not see it.
    const raif = within(folderOf("RaiffeisenBank")).getAllByRole("listitem");
    expect(raif).toHaveLength(3);
    for (const li of raif) {
      expect(within(li).queryByText(/^(QA|BA)( · .*)?$/)).toBeNull();
    }
  });

  it("«All recordings» → the plain list; the address says so", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("button", { name: "All recordings" }));
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(rows()).toHaveLength(6);
    expect(params().get("view")).toBe("all");
  });

  it("A–Z", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("button", { name: "A–Z" }));
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Ajax", "PrivatBank", "RaiffeisenBank"]);
  });
});

describe("filters (D69) and the address (D70)", () => {
  beforeEach(() => serve(BY_COMPANY));

  it("a link with filters opens the same selection; a single company left opens by itself", async () => {
    nav.query = new URLSearchParams("dir=ba&stage=recruiter");
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "BA 1", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Recruiter/, pressed: true })).toBeInTheDocument();
    expect(folderButton("PrivatBank")).toHaveAttribute("aria-expanded", "true");
    expect(within(folderOf("PrivatBank")).getAllByRole("listitem")).toHaveLength(1);
    expect(within(folderOf("PrivatBank")).getByRole("listitem")).toHaveTextContent("Дарина Бойко");
  });

  it("choosing filters writes them into the address; «Clear filters» empties it", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("button", { name: /^QA/ }));
    await user.click(screen.getByRole("button", { name: /^Technical/ }));
    expect(params().get("dir")).toBe("qa");
    expect(params().get("stage")).toBe("tech");
    // Only what is left: no BA recruiter at PrivatBank.
    expect(folderButton("PrivatBank")).toHaveTextContent("1");
    expect(folderButton("PrivatBank")).not.toHaveTextContent("Recruiter");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.search).toBe("");
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("stages: several at once; each shows how many it would give", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    expect(screen.getByRole("button", { name: "Recruiter 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Technical 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manager 0" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recruiter 2" }));
    await user.click(screen.getByRole("button", { name: "Manager 0" }));
    expect(params().get("stage")).toBe("recruiter,manager");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["PrivatBank", "RaiffeisenBank"]);
  });

  it("company: pick it from the list — searched by name — and see only it, open", async () => {
    const user = userEvent.setup({ skipHover: true });
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("combobox", { name: "Company" }));
    await user.type(screen.getByPlaceholderText("Find a company…"), "priv");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["PrivatBank2"]);
    await user.click(screen.getByRole("option", { name: /PrivatBank/ }));
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["PrivatBank"]);
    expect(folderButton("PrivatBank")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Company" })).toHaveTextContent("PrivatBank");
    expect(params().get("company")).toBe("privatbank");
  });

  it("search in the folders: only the companies with a match", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.type(screen.getByPlaceholderText("Search…"), "руденко");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["PrivatBank"]);
    expect(within(folderOf("PrivatBank")).getByRole("listitem")).toHaveTextContent("Богдан_Руденко_QA");
    expect(params().get("q")).toBe("руденко");
  });

  // Owner 2026-10-18: «if you don't find the name in Ukrainian, search in English too» — most
  // company names (127 of 135) and many file names are in Latin letters.
  it("searched in Ukrainian → a hint to try English, even when something was found; in English → no hint", async () => {
    const user = userEvent.setup();
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    const hint = /Most names are written in Latin letters — try English too/;
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    // The live region is there before anything is typed — screen readers announce what appears in it.
    expect(screen.getByRole("status")).toHaveTextContent("");
    await user.type(screen.getByPlaceholderText("Search…"), "приватбанк");
    expect(screen.getByRole("status")).toHaveTextContent(hint);
    expect(screen.getByText("No recordings match these filters.")).toBeInTheDocument();
    // Something found in Ukrainian (a person) — the hint stays: the company may be in Latin letters.
    await user.clear(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "руденко");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText(hint)).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Search…"));
    await user.type(screen.getByPlaceholderText("Search…"), "privat");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it("company list: nothing in Ukrainian → try English; nothing in English → no such company", async () => {
    const user = userEvent.setup({ skipHover: true });
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("combobox", { name: "Company" }));
    await user.type(screen.getByPlaceholderText("Find a company…"), "приват");
    expect(screen.getByText("Nothing in Ukrainian. Try English, like «PrivatBank».")).toBeInTheDocument();
    expect(screen.queryByText("No such company.")).not.toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Find a company…"));
    await user.type(screen.getByPlaceholderText("Find a company…"), "zzz");
    expect(screen.getByText("No such company.")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing in Ukrainian/)).not.toBeInTheDocument();
  });

  // Code review 2026-10-18: closing the list by a pick skipped the reset — next time it opened
  // filtered by the old query, «All companies» hidden.
  it("company list: after a pick it opens fresh — empty search, «All companies» there to go back", async () => {
    const user = userEvent.setup({ skipHover: true });
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    await user.click(screen.getByRole("combobox", { name: "Company" }));
    await user.type(screen.getByPlaceholderText("Find a company…"), "priv");
    await user.click(screen.getByRole("option", { name: /PrivatBank/ }));
    await user.click(screen.getByRole("combobox", { name: "Company" }));
    expect(screen.getByPlaceholderText("Find a company…")).toHaveValue("");
    await user.click(screen.getByRole("option", { name: /All companies/ }));
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("nothing matches → says so, with the filters still there to change", async () => {
    nav.query = new URLSearchParams("dir=ba&stage=manager");
    render(<InterviewRecordingsLibrary />);
    expect(await screen.findByText("No recordings match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });
});

describe("the «Співбесіди» page — the library and nothing else", () => {
  it("connected → the library right away: no tabs, no «My interviews», the recordings load", async () => {
    configured.value = true;
    render(await InterviewsPage());
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("my-interviews")).not.toBeInTheDocument();
    expect(screen.getByText("Interview recordings")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/skillklan/interview-recordings", expect.anything()));
  });

  it("not connected yet → says so: no old list, no tabs, the library is not asked", async () => {
    render(await InterviewsPage());
    expect(screen.getByText("Interview recordings are not connected yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("my-interviews")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
