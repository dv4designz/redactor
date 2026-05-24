"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Plus } from "lucide-react";
import { saveFile, generateId, getAllFiles } from "../../lib/store/fileStore";
import { extractPDFPages, hasTextLayer } from "../../lib/pdf/renderer";
import { getWorker } from "../../lib/ocr/engine";
import { detectPII } from "../../lib/pii/detector";
import type { ProcessedFile } from "../../types";

export default function DashboardPage() {
  const router = useRouter();
  const [files, setFiles] = useState<{ name: string; id: string; pageCount: number; itemCount: number }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, label: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWorker().catch(console.error);
    setFiles(getAllFiles().map((f) => ({ name: f.name, id: f.id, pageCount: f.pages.length, itemCount: f.detectedItems.length })));
  }, []);

  async function handleUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const selectedFiles = (e.target as HTMLInputElement).files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      setProcessing(true);
      setError(null);
      for (const file of Array.from(selectedFiles)) {
        await processFile(file);
      }
      setFiles(getAllFiles().map((f) => ({ name: f.name, id: f.id, pageCount: f.pages.length, itemCount: f.detectedItems.length })));
      setProcessing(false);
    };
    input.click();
  }

  async function processFile(file: File) {
    setProgress({ pct: 5, label: `Reading ${file.name}...` });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    setProgress({ pct: 15, label: "Extracting pages..." });
    const pages = await extractPDFPages(bytes.buffer, (cur, total) => {
      setProgress({ pct: 15 + Math.round((cur / total) * 35), label: `Page ${cur} of ${total}` });
    });

    const fileId = generateId();
    const processed: ProcessedFile = {
      id: fileId,
      name: file.name,
      fileDataUrl: dataUrl,
      pages,
      detectedItems: [],
      createdAt: Date.now(),
    };

    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      const basePct = 50 + Math.round(((i + 1) / pages.length) * 45);
      setProgress({ pct: basePct, label: `Analyzing page ${i + 1} of ${pages.length}...` });

      await new Promise<void>((r) => setTimeout(r, 0));

      let ocrText = pg.textContent;
      const wordsForOcr: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }> = [];

      if (hasTextLayer(pg)) {
        // Use existing text layer — create dummy word entries for PII detection
        const tokens = pg.textContent.split(/\s+/).filter(Boolean);
        for (let t = 0; t < tokens.length; t++) {
          wordsForOcr.push({ text: tokens[t], bbox: { x: 0, y: 0, width: 0, height: 0 } });
        }
      } else {
        // Run OCR on scanned page
        try {
          const worker = await getWorker();
          const result = await worker.recognize(pg.imageDataUrl);
          ocrText = result.data.text;
          for (const word of result.data.words) {
            if (word.confidence < 50) continue;
            wordsForOcr.push({
              text: word.text,
              bbox: {
                x: word.bbox.x0 / pg.width,
                y: word.bbox.y0 / pg.height,
                width: (word.bbox.x1 - word.bbox.x0) / pg.width,
                height: (word.bbox.y1 - word.bbox.y0) / pg.height,
              },
            });
          }
        } catch (err) {
          console.error("OCR error page", i + 1, err);
        }
      }

      const items = detectPII(ocrText, wordsForOcr, i + 1);
      processed.detectedItems.push(...items);
    }

    saveFile(processed);
    setProgress({ pct: 100, label: "Done!" });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: "#2563eb", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Shield size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Redactor.app</span>
        </div>
        <button className="btn btn-primary" onClick={handleUpload} disabled={processing}>
          <Plus size={16} /> Upload PDF{processing ? "s" : ""}
        </button>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {processing ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ width: 48, height: 48, background: "#2563eb", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "white" }}>
              <Shield size={24} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{progress.label}</p>
            <div style={{ width: 320, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", margin: "0 auto 12px" }}>
              <div style={{ width: `${progress.pct}%`, height: "100%", background: "#2563eb", transition: "width 0.3s" }} />
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>{progress.pct}%</p>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#ef4444", fontSize: 14, marginBottom: 24 }}>
                {error}
              </div>
            )}
            {files.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px" }}>
                <div style={{ width: 64, height: 64, background: "#f1f5f9", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#94a3b8" }}>
                  <Plus size={32} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No documents yet</p>
                <p style={{ color: "#64748b", marginBottom: 24 }}>Upload a PDF to detect and redact PII</p>
                <button className="btn btn-primary" onClick={handleUpload}>
                  <Plus size={16} /> Upload PDF
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600 }}>{files.length} Document{files.length !== 1 ? "s" : ""}</h2>
                  <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={handleUpload}>
                    <Plus size={14} /> Add more
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {files.map((f) => (
                    <div key={f.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{f.name}</p>
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>{f.pageCount} pages · {f.itemCount} items detected</p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 12, color: "#ef4444" }} onClick={() => {
                          const all = getAllFiles().filter((x) => x.id !== f.id);
                          localStorage.setItem("redactor_files", JSON.stringify(all));
                          setFiles((prev) => prev.filter((x) => x.id !== f.id));
                        }}>Delete</button>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => router.push(`/review?fileId=${f.id}`)}>Review</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}