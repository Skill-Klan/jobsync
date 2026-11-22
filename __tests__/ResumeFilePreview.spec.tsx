// Requirement — SKD-56: a resume with a file has a "Preview" button; it opens
// the file in the page without downloading it (the file is asked from
// ?view=1, never from the download address), a Word document shows in a
// sandboxed frame, and a file that cannot be shown says so.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResumeFilePreviewButton } from "@/components/profile/ResumeFilePreview";

vi.mock("@/components/pdf-export/PdfPreviewPane", () => ({
  PdfPreviewPane: ({ blob, previewLabel }: { blob: Blob | null; previewLabel: string }) => (
    <div data-testid="pdf-pane" data-size={blob?.size}>{previewLabel}</div>
  ),
}));

const open = () => {
  render(<ResumeFilePreviewButton resumeId="r 1" title="My CV" />);
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
};

describe("ResumeFilePreviewButton", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a PDF is asked for reading (view=1) and drawn by the PDF pane", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "application/pdf" }), blob: async () => new Blob(["%PDF-1"]) }) as unknown as typeof fetch;

    open();

    expect(await screen.findByTestId("pdf-pane")).toHaveAttribute("data-size", "6");
    expect((global.fetch as any).mock.calls[0][0]).toBe("/api/profile/resume?resumeId=r%201&view=1");
  });

  it("a Word document is shown in a frame that allows no scripts", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), text: async () => "<p>Hello</p>" }) as unknown as typeof fetch;

    open();

    const frame = await screen.findByTitle("My CV");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(frame).toHaveAttribute("srcdoc", "<p>Hello</p>");
    expect(screen.queryByTestId("pdf-pane")).toBeNull();
  });

  // Review fix (SKD-67): a Word file uploaded under a ".pdf" name is still shown as a page.
  it("what the server sent decides, not the file's name", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), text: async () => "<p>Word</p>" }) as unknown as typeof fetch;
    render(<ResumeFilePreviewButton resumeId="r1" title="cv.pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect((await screen.findByTitle("cv.pdf")).tagName).toBe("IFRAME");
    expect(screen.queryByTestId("pdf-pane")).toBeNull();
  });

  it("a file the server refuses → a message, no frame", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 415 }) as unknown as typeof fetch;

    open();

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be shown/i);
    expect(screen.queryByTitle("My CV")).toBeNull();
  });

  it("nothing is fetched until the button is pressed (paired case)", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<ResumeFilePreviewButton resumeId="r1" title="My CV" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument());
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
