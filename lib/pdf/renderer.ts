// PDF Renderer — converts PDF pages to image data URLs
import * as pdfjsLib from "pdfjs-dist";
import { PDFPage } from "../../types";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export async function extractPDFPages(
  data: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<PDFPage[]> {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const numPages = doc.numPages;
  const pages: PDFPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imageDataUrl = canvas.toDataURL("image/png");

    // Extract text layer if available (non-scanned pages)
    let textContent = "";
    try {
      const tc = await page.getTextContent();
      const parts: string[] = [];
      for (const item of tc.items as Array<{ str?: string }>) {
        if (item.str) parts.push(item.str);
      }
      textContent = parts.join(" ");
    } catch { /* ignore */ }

    pages.push({ pageNumber: i, width: viewport.width, height: viewport.height, imageDataUrl, textContent });

    // Yield to event loop between pages
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  return pages;
}

export function hasTextLayer(page: PDFPage): boolean {
  return page.textContent.trim().length > 20;
}