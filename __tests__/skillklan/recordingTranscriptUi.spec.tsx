// Requirement — the owner, 2026-11-20, and the mockup approved the same day
// (D105): beside a recording, «Транскрибувати»; while it is being made, a
// spinner; when it is done, the panel below the recording opens by itself with
// the text and «Копіювати» — the text with who speaks and when (D106); the
// transcript is kept, so pressing again shows the text at once (the button is
// «Текст» from then on) and nobody pays for it twice. Behind the «Транскрибація»
// switch: off — no button at all. Refusals in plain words: the person's previous
// recording still waits; transcription temporarily unavailable.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InterviewRecordingsLibrary from "@/components/interviews/InterviewRecordingsLibrary";
import { TRANSCRIPT_POLL_MS } from "@/components/interviews/RecordingTranscript";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/skillklan/interviewRecordings", () => ({ isRecordingsConfigured: () => true }));
const nav = vi.hoisted(() => ({ query: new URLSearchParams("view=all") }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/interviews",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => nav.query,
}));

const RECORDINGS = [
  { id: "fileQaTech001", kind: "qaTech", mimeType: "audio/mpeg", date: "2026-09-24", specializations: [], person: "Іван Петренко", company: "Monobank", title: "24.09.2026 - Іван Петренко - Monobank" },
  { id: "fileQaTech002", kind: "qaTech", mimeType: "audio/mpeg", date: "2026-09-20", specializations: [], person: "Олена Коваль", company: "PrivatBank", title: "20.09.2026 - Олена Коваль - PrivatBank" },
];
const SEGMENTS = [
  { speaker: 1, start: 0, text: "Розкажіть про себе." },
  { speaker: 2, start: 3.4, text: "Я тестувальниця." },
];

type Transcription = { available: boolean; states: Record<string, string> } | undefined;
let transcription: Transcription;
let views: Record<string, unknown[]>;
let postAnswer: { status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;
const writeText = vi.fn(async (_text: string) => {});

const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  setTestLocale("en");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  transcription = { available: true, states: {} };
  views = {};
  postAnswer = { status: 200, body: { status: "queued" } };
  fetchMock = vi.fn((input: string, init?: RequestInit) => {
    if (input === "/api/skillklan/interview-recordings") {
      return answer(200, { recordings: RECORDINGS, attachments: [], ...(transcription && { transcription }) });
    }
    const id = decodeURIComponent(input.split("/")[4]);
    if (init?.method === "POST") return answer(postAnswer.status, postAnswer.body);
    const queue = views[id] ?? [{ status: "none" }];
    return answer(200, queue.length > 1 ? queue.shift() : queue[0]);
  });
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  writeText.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const rowOf = async (name: string) => (await screen.findByText(new RegExp(name))).closest("li") as HTMLElement;
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");

describe("the switch", () => {
  it("off — no «Transcribe» anywhere; on — one beside every recording", async () => {
    transcription = undefined;
    const { unmount } = render(<InterviewRecordingsLibrary />);
    await rowOf("Іван Петренко");
    expect(screen.queryByRole("button", { name: "Transcribe" })).toBeNull();
    unmount();

    transcription = { available: true, states: {} };
    render(<InterviewRecordingsLibrary />);
    await rowOf("Іван Петренко");
    expect(screen.getAllByRole("button", { name: "Transcribe" })).toHaveLength(2);
  });

  it("in Ukrainian the button says «Транскрибувати»", async () => {
    setTestLocale("uk");
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    expect(within(row).getByRole("button", { name: "Транскрибувати" })).toBeInTheDocument();
  });
});

describe("pressing «Transcribe»", () => {
  it("spins while it is made, then the panel opens by itself with who speaks and when; «Copy» copies it", async () => {
    views.fileQaTech001 = [{ status: "running" }, { status: "done", languageCode: "ukr", segments: SEGMENTS }];
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");

    fireEvent.click(within(row).getByRole("button", { name: "Transcribe" }));
    await waitFor(() => expect(within(row).getByRole("button", { name: "Transcribing…" })).toBeDisabled());
    expect(posts().map(([url]) => url)).toEqual(["/api/skillklan/interview-recordings/fileQaTech001/transcript"]);
    expect(within(row).getByRole("status")).toHaveTextContent(/usually a few minutes/);
    expect(within(row).queryByRole("region", { name: "Transcript" })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS));
    await waitFor(() => expect(within(row).getByRole("button", { name: "Transcribing…" })).toBeDisabled());
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS));

    const panel = await within(row).findByRole("region", { name: "Transcript" });
    expect(panel).toHaveTextContent("Speaker 1 · 00:00");
    expect(panel).toHaveTextContent("Розкажіть про себе.");
    expect(panel).toHaveTextContent("Speaker 2 · 00:03");
    expect(panel).toHaveTextContent("Я тестувальниця.");
    expect(within(row).getByRole("button", { name: "Text" })).toBeEnabled();
    expect(within(row).queryByRole("status")).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("Speaker 1 (00:00): Розкажіть про себе.\n\nSpeaker 2 (00:03): Я тестувальниця.");
    expect(await within(panel).findByRole("button", { name: "Copied" })).toBeInTheDocument();

    // Collapse, then «Text» opens it again — no second request to make it.
    fireEvent.click(within(panel).getByRole("button", { name: "Collapse" }));
    expect(within(row).queryByRole("region", { name: "Transcript" })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Text" }));
    expect(within(row).getByRole("region", { name: "Transcript" })).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it("made before (by anyone) — «Text» opens it at once, nothing is asked to be made", async () => {
    transcription = { available: true, states: { fileQaTech001: "done" } };
    views.fileQaTech001 = [{ status: "done", languageCode: "ukr", segments: SEGMENTS }];
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");

    fireEvent.click(within(row).getByRole("button", { name: "Text" }));
    const panel = await within(row).findByRole("region", { name: "Transcript" });
    expect(panel).toHaveTextContent("Я тестувальниця.");
    expect(posts()).toHaveLength(0);
  });

  it("being made for someone else — spins, and becomes «Text» without opening on its own", async () => {
    transcription = { available: true, states: { fileQaTech002: "queued" } };
    views.fileQaTech002 = [{ status: "done", languageCode: "ukr", segments: SEGMENTS }];
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Олена Коваль");
    expect(within(row).getByRole("button", { name: "Transcribing…" })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS));
    await waitFor(() => expect(within(row).getByRole("button", { name: "Text" })).toBeEnabled());
    expect(within(row).queryByRole("region", { name: "Transcript" })).toBeNull();
  });

  it("silence — the panel says no speech was recognized, and there is nothing to copy", async () => {
    transcription = { available: true, states: { fileQaTech001: "done" } };
    views.fileQaTech001 = [{ status: "done", languageCode: null, segments: [] }];
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    fireEvent.click(within(row).getByRole("button", { name: "Text" }));
    const panel = await within(row).findByRole("region", { name: "Transcript" });
    expect(panel).toHaveTextContent("No speech was recognized in this recording.");
    expect(within(panel).queryByRole("button", { name: "Copy" })).toBeNull();
  });
});

describe("refusals, in plain words", () => {
  it("the person's previous recording still waits (409)", async () => {
    postAnswer = { status: 409, body: { error: "busy" } };
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    fireEvent.click(within(row).getByRole("button", { name: "Transcribe" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent("Wait for your previous recording first");
    expect(within(row).getByRole("button", { name: "Transcribe" })).toBeEnabled();
  });

  it("the provider can't take work (503)", async () => {
    postAnswer = { status: 503, body: { error: "unavailable" } };
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    fireEvent.click(within(row).getByRole("button", { name: "Transcribe" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent("Transcription is unavailable for now");
  });

  it("already known to be unavailable — said at once, nothing is sent", async () => {
    transcription = { available: false, states: {} };
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    fireEvent.click(within(row).getByRole("button", { name: "Transcribe" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent("Transcription is unavailable for now");
    expect(posts()).toHaveLength(0);
  });

  it("it failed while being made — said so, and it can be pressed again", async () => {
    views.fileQaTech001 = [{ status: "failed" }];
    render(<InterviewRecordingsLibrary />);
    const row = await rowOf("Іван Петренко");
    fireEvent.click(within(row).getByRole("button", { name: "Transcribe" }));
    await waitFor(() => expect(within(row).getByRole("button", { name: "Transcribing…" })).toBeDisabled());
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS));
    expect(await within(row).findByRole("alert")).toHaveTextContent("Couldn't transcribe the recording. Try again.");
    expect(within(row).getByRole("button", { name: "Transcribe" })).toBeEnabled();
  });
});
