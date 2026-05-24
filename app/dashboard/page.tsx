"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shield, ChevronLeft, Check, X } from "lucide-react";
import { saveFile, generateId } from "../../lib/store/fileStore";
import { extractPDFPages, hasTextLayer } from "../../lib/pdf/renderer";
import { getWorker, terminateWorker } from "../../lib/ocr/engine";
import { detectPII } from "../../lib/pii/detector";
import { ProcessedFile } from "../../types";

export default function DashboardPage() {
  const router = useRouter();
  const [file, setFile] = useState<ProcessedFile | null>(null);
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [progress, setProgress] = useState({ current: 0, total: 0, pct: 0, label: "" });
  const [error, setError] = useState<string | null>(null);
  const warmUpDone = useRef(false);

  // Warm up OCR worker on mount
  useEffect(() => {
    if (!warmUpDone.current) {
      warmUpDone.current = true;
      getWorker().catch(console.error);
    }
    return () => { /* keep worker alive for review page */ };
  }, []);

  async function processFile() {
    const stored = sessionStorage.getItem("uploadedFile");
    if (!stored) { router.push("/"); return; }

    const { name, dataUrl, type } = JSON.parse(stored);
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    setStep("processing");
    setProgress({ current: 0, total: 5, pct: 5, label: "Extracting pages..." });

    try {
      const pages = await extractPDFPages(bytes.buffer, (cur, total) => {
        setProgress({ current: cur, total, pct: 5 + Math.round((cur / total) * 60), label: `Page ${cur} of ${total}` });
      });

      const fileId = generateId();
      const processed: ProcessedFile = {
        id: fileId,
        name,
        fileDataUrl: dataUrl,
        pages,
        detectedItems: [],
        createdAt: Date.now(),
      };

      // Process each page — skip OCR for pages with text layer
      let detectedItems: ProcessedFile["detectedItems"] = [];
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i];
        const basePct = 65 + Math.round(((i + 1) / pages.length) * 30);
        setProgress({ current: i + 1, total: pages.length, pct: basePct, label: `Analyzing page ${i + 1}...` });

        if (hasTextLayer(pg)) {
          // Text already extractable — still scan for PII
          const words = pg.textContent.split(/\s+/).filter(Boolean).map((text, idx) => ({
            text, bbox: { x: 0, y: 0, width: 0, height: 0 }
          }));
          const items = detectPII(pg.textContent, words, i + 1);
          detectedItems = detectedItems.concat(items);
        } else {
          // Scanned page — run OCR with per-page yielding
          await new Promise<void>((r) => setTimeout(r, 0)); // yield

          const { text, words } = await (async () => {
            // Throttle: only update progress every 200ms
            let lastUpdate = 0;
            const w = await getWorker();
            const result = await w.recognize(pg.imageDataUrl);

            const filtered = result.data.words
              .filter((word) => word.confidence > 50)
              .map((word) => ({
                text: word.text,
                bbox: {
                  x: word.bbox.x0 / 100,
                  y: word.bbox.y0 / 100,
                  width: (word.bbox.x1 - word.bbox.x0) / 100,
                  height: (word.bbox.y1 - word.bbox.y0) / 100,
                },
              }));

            return { text: result.data.text, words: filtered };
          })();

          const items = detectPII(text, words, i + 1);
          detectedItems = detectedItems.concat(items);
        }

        // Yield between pages
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      processed.detectedItems = detectedItems;
      saveFile(processed);
      setFile(processed);
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setStep("upload");
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem("uploadedFile");
    if (!stored) return;
    const { name } = JSON.parse(stored);
    if (name) processFile();
  }, []);

  if (step === "review" && file) {
    router.replace(`/review?fileId=${file.id}`);
    return null;
  }

  if (step === "processing") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ width: 48, height: 48, background: "#2563eb", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
          <Shield size={24} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Analyzing document...</p>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>{progress.label}</p>
          <div style={{ width: 300, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${progress.pct}%`, height: "100%", background: "#2563eb", transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>{progress.pct}%</p>
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ color: "#64748b" }}>Processing complete. <button onClick={() => router.push("/")} className="btn btn-secondary">Upload another</button></p>
      {error && <p style={{ color: "#ef4444" }}>{error}</p>}
    </div>
  );
}