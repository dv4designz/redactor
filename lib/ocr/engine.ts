// OCR Engine — Tesseract singleton worker (main thread)
import Tesseract from "tesseract.js";

let worker: Tesseract.Worker | null = null;

export async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker("eng");
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
        x: word.bbox.x0 / 100,
        y: word.bbox.y0 / 100,
        width: (word.bbox.x1 - word.bbox.x0) / 100,
        height: (word.bbox.y1 - word.bbox.y0) / 100,
      },
    }));

  return { text: result.data.text, words };
}