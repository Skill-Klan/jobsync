// pdf.js for the attachments viewer — unpdf's build, loaded on the first PDF
// opened (it is large), not with the page.
export type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
};
export type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPage> };

// pdf.js takes the bytes it is given (their buffer is detached after).
export async function openPdf(bytes: Uint8Array): Promise<PdfDocument> {
  const { getDocumentProxy } = await import("unpdf");
  return (await getDocumentProxy(bytes)) as unknown as PdfDocument;
}
