// Requirement — the owner, 2026-10-19, and the approved mock-up (D77–D80):
//   · «Вкладення N» beside a recording for what is certainly its; «Вкладення
//     до теки N» on the company's stage and on a candidate's folder for the
//     rest; in «Усі записи» only what is beside a recording; a direction
//     picked hides a folder's attachments of the other direction;
//   · the menu: each file by name; pictures, PDFs and the other files the
//     browser can show — «Переглянути»; the rest — «Перегляд недоступний»;
//   · the viewer: pictures and PDF pages on a canvas, a Word document in a frame
//     without scripts, text as text; "1 з 2" and arrows between the files;
//     pages of a PDF one at a time; no download anywhere — no download button
//     or link, no <img> to "Save image as", no right-click menu; the page asks
//     for a file with its own header (the address alone opens nothing).
import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewRecordingsLibrary from "@/components/interviews/InterviewRecordingsLibrary";
import { setTestLocale } from "../helpers/i18n";

const nav = vi.hoisted(() => ({ query: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/interviews",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => nav.query,
}));
const pdf = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  getPage: vi.fn(),
}));
vi.mock("@/components/interviews/pdfDocument", () => ({ openPdf: pdf.getDocumentProxy }));

const rec = (id: string, kind: string, person: string, folder: string | null = null) => ({
  id, kind, mimeType: "audio/mpeg", date: "2026-03-12", specializations: [], person, company: "Acme", title: person, folder,
});
const RECORDINGS = [
  rec("recHr0000001", "qaRecruiter", "Олена К."),
  rec("recTech00001", "qaTech", "Андрій П."),
  rec("recTech00002", "qaTech", "Ірина С."),
  rec("recCand00001", "qaTech", "Кандидат, частина 1", "Кандидат_QA"),
  rec("recBaTech001", "baTech", "Дарина Б."),
];
const att = (id: string, name: string, view: string, kind: string, folder: string | null, recordingId: string | null) => ({
  id, name, mimeType: "x/x", size: 1, kind, company: "Acme", folder, recordingId, view,
});
const ATTACHMENTS = [
  att("attRec000001", "task_screenshot.png", "image", "qaRecruiter", null, "recHr0000001"),
  att("attRec000002", "test_assignment.pdf", "pdf", "qaRecruiter", null, "recHr0000001"),
  att("attStage0001", "schema_task.png", "image", "qaTech", null, null),
  att("attBaStage01", "ba_flow.png", "image", "baTech", null, null),
  att("attCand00001", "checklist.js", "text", "qaTech", "Кандидат_QA", null),
  att("attCand00002", "notes.docx", "page", "qaTech", "Кандидат_QA", null),
  att("attCand00003", "results.xlsx", "none", "qaTech", "Кандидат_QA", null),
];

let fetchMock: ReturnType<typeof vi.fn>;
const BODIES: Record<string, () => Response> = {
  attRec000001: () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } }),
  attRec000002: () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } }),
  attCand00001: () => new Response("// перевірка\nfunction check() {}", { headers: { "x-skillklan-truncated": "1" } }),
  attCand00002: () => new Response("<!doctype html><body><h1>Нотатки</h1></body>"),
};

beforeEach(() => {
  setTestLocale("uk");
  // One company — its folder opens by itself.
  nav.query = new URLSearchParams();
  window.history.replaceState(null, "", "/");
  fetchMock = vi.fn(async (input: string) => {
    const id = String(input).match(/\/attachments\/([^/?]+)/)?.[1];
    if (id) return (BODIES[id] ?? (() => new Response("{}", { status: 415 })))();
    return new Response(JSON.stringify({ recordings: RECORDINGS, attachments: ATTACHMENTS }));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 10, height: 5, close: vi.fn() })));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  pdf.getPage.mockResolvedValue({
    getViewport: () => ({ width: 100, height: 140 }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
  });
  // Like pdf.js: the buffer it is given is taken (detached).
  pdf.getDocumentProxy.mockImplementation(async (data: Uint8Array) => {
    if (data.byteLength === 0) throw new DataCloneErrorLike();
    (data.buffer as ArrayBuffer & { transfer: () => ArrayBuffer }).transfer();
    return { numPages: 3, getPage: pdf.getPage };
  });
});
class DataCloneErrorLike extends Error {}

const clips = () => screen.queryAllByRole("button", { name: /^Вкладення: \d+$/ });
// In «Усі записи» the row says "Acme · Олена К." — the name is found within it.
const rowOf = (person: string) =>
  screen.getAllByRole("listitem").find((li) => li.textContent?.includes(person)) as HTMLElement;
const openMenu = async (button: HTMLElement) => {
  await userEvent.setup().click(button);
  return screen.findByRole("dialog");
};

describe("where the buttons are", () => {
  it("by company: beside the recording (its 2), on the stage «Технічна» (QA and BA: 2), on the candidate's folder (3)", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips()).toHaveLength(3));
    expect(within(rowOf("Олена К.")).getByRole("button", { name: "Вкладення: 2" })).toBeInTheDocument();
    // Not beside the other recordings: theirs is on the folder.
    expect(within(rowOf("Андрій П.")).queryByRole("button", { name: /Вкладення/ })).toBeNull();
    const folderButtons = clips().filter((b) => b.textContent?.includes("Вкладення до теки"));
    expect(folderButtons.map((b) => b.getAttribute("aria-label"))).toEqual(["Вкладення: 2", "Вкладення: 3"]);
    // The candidate's folder button sits by its name.
    expect(screen.getByText("Кандидат_QA").parentElement).toContainElement(folderButtons[1]);
  });

  it("«Усі записи»: only what is beside a recording", async () => {
    nav.query = new URLSearchParams("view=all");
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips()).toHaveLength(1));
    expect(within(rowOf("Олена К.")).getByRole("button", { name: "Вкладення: 2" })).toBeInTheDocument();
  });

  it("direction QA picked → the BA folder's attachment is not on the stage", async () => {
    nav.query = new URLSearchParams("dir=qa");
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips().length).toBeGreaterThan(0));
    const folderButtons = clips().filter((b) => b.textContent?.includes("Вкладення до теки"));
    expect(folderButtons.map((b) => b.getAttribute("aria-label"))).toEqual(["Вкладення: 1", "Вкладення: 3"]);
  });
});

describe("the menu", () => {
  it("each file by name; viewable — «Переглянути» (a button), the rest — «Перегляд недоступний» (not a button)", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips()).toHaveLength(3));
    await userEvent.setup().click(clips()[2]);
    const menu = await screen.findByText("Лежать у теці — не прив'язані до одного запису.");
    const list = within(menu.parentElement as HTMLElement);
    expect(list.getByRole("button", { name: /checklist\.js.*Переглянути/ })).toBeInTheDocument();
    expect(list.getByRole("button", { name: /notes\.docx.*Переглянути/ })).toBeInTheDocument();
    expect(list.queryByRole("button", { name: /results\.xlsx/ })).toBeNull();
    expect(list.getByText("results.xlsx").parentElement).toHaveTextContent("Перегляд недоступний");
  });
});

describe("the viewer", () => {
  const openFromRecording = async (name: RegExp) => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips()).toHaveLength(3));
    const user = userEvent.setup();
    await user.click(within(rowOf("Олена К.")).getByRole("button", { name: "Вкладення: 2" }));
    await user.click(await screen.findByRole("button", { name }));
    return screen.findByRole("dialog");
  };

  it("a picture: asked with the page's header, drawn on a canvas; no <img>, no download, no right-click menu", async () => {
    const dialog = await openFromRecording(/task_screenshot\.png/);
    await within(dialog).findByRole("img", { name: "task_screenshot.png" });
    expect(within(dialog).getByRole("img", { name: "task_screenshot.png" }).tagName).toBe("CANVAS");
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("/attachments/"))!;
    expect(url).toBe("/api/skillklan/interview-recordings/attachments/attRec000001");
    expect(init.headers).toEqual({ "x-skillklan-viewer": "1" });
    expect(dialog.querySelector("img")).toBeNull();
    expect(dialog.querySelector("[download], a[href]")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /завантаж|download|зберег/i })).toBeNull();
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(fireEvent.contextMenu(within(dialog).getByRole("img"))).toBe(false); // prevented
  });

  it("«1 з 2» and the arrows go through the files of this menu", async () => {
    const dialog = await openFromRecording(/task_screenshot\.png/);
    expect(within(dialog).getByText("1 з 2")).toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Наступне вкладення" }));
    expect(within(dialog).getByText("2 з 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "test_assignment.pdf" })).toBeInTheDocument();
  });

  it("a PDF: drawn by pdf.js page by page — from a copy of the file, so a second draw still works", async () => {
    render(
      <StrictMode>
        <InterviewRecordingsLibrary />
      </StrictMode>,
    );
    await waitFor(() => expect(clips()).toHaveLength(3));
    const user = userEvent.setup();
    await user.click(within(rowOf("Олена К.")).getByRole("button", { name: "Вкладення: 2" }));
    await user.click(await screen.findByRole("button", { name: /test_assignment\.pdf/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Сторінка 1 з 3")).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Наступна сторінка" }));
    expect(within(dialog).getByText("Сторінка 2 з 3")).toBeInTheDocument();
    await waitFor(() => expect(pdf.getPage).toHaveBeenLastCalledWith(2));
    expect(dialog.querySelector("iframe, embed, object")).toBeNull(); // not the browser's viewer
  });

  it("a Word document: in a frame that runs no scripts; text: as text, a cut one says so; cannot be shown → said", async () => {
    render(<InterviewRecordingsLibrary />);
    await waitFor(() => expect(clips()).toHaveLength(3));
    const user = userEvent.setup();
    await user.click(clips()[2]);
    await user.click(await screen.findByRole("button", { name: /notes\.docx/ }));
    let dialog = await screen.findByRole("dialog");
    const frame = (await within(dialog).findByTitle("notes.docx")) as HTMLIFrameElement;
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("<h1>Нотатки</h1>");

    await user.click(within(dialog).getByRole("button", { name: "Попереднє вкладення" }));
    dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(/function check\(\) \{\}/)).toBeInTheDocument();
    expect(within(dialog).getByText("Показано початок — файл задовгий.")).toBeInTheDocument();
  });

  it("the server says it cannot be shown → «Цей файл не вдалося показати.»", async () => {
    BODIES.attRec000001 = () => new Response("{}", { status: 415 });
    const dialog = await openFromRecording(/task_screenshot\.png/);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Цей файл не вдалося показати.");
  });
});
