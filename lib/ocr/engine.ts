// OCR Engine — runs Tesseract in a Web Worker to avoid freezing the UI
import Tesseract from "tesseract.js";

let worker: Tesseract.Worker | null = null;

export async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] ${Math.round((m.progress as number) * 100)}%`);
        }
      },
    });
  }
  return worker;
}

export async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

export async function recognizeText(imageDataUrl: string): Promise<{
  text: string;
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>;
}> {
  const w = await getWorker();
  const result = await w.recognize(imageDataUrl);

  const words = result.data.words
    .filter((w) => w.confidence > 60)
    .map((word) => ({
      text: word.text,
      bbox: {
        x: word.bbox.x0 / 100, // normalize to 0-1
        y: word.bbox.y0 / 100,
        width: (word.bbox.x1 - word.bbox.x0) / 100,
        height: (word.bbox.y1 - word.bbox.y0) / 100,
      },
    }));

  return { text: result.data.text, words };
}