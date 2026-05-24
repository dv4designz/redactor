"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Shield, Download, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { getFile } from "../../lib/store/fileStore";
import { ProcessedFile, DetectedItem } from "../../types";

type ItemStatus = "pending" | "accepted" | "rejected";

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId") ?? "";

  const [file, setFile] = useState<ProcessedFile | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const f = getFile(fileId);
    if (!f) { router.push("/dashboard"); return; }
    setFile(f);
  }, [fileId, router]);

  if (!file) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>;
  }

  const page = file.pages[currentPage] ?? file.pages[0];
  if (!page) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>No pages found</p></div>;
  }

  const pageItems = file.detectedItems.filter((i) => i.page === currentPage + 1);

  function toggleItem(id: string) {
    if (!file) return;
    const updated = file.detectedItems.map((item) => {
      if (item.id !== id) return item;
      const newStatus: ItemStatus = item.status === "accepted" ? "pending" : "accepted";
      return { ...item, status: newStatus };
    });
    setFile({ ...file, detectedItems: updated });
  }

  function acceptAll() {
    if (!file) return;
    setFile({ ...file, detectedItems: file.detectedItems.map((i) => ({ ...i, status: "accepted" as ItemStatus })) });
  }

  function rejectAll() {
    if (!file) return;
    setFile({ ...file, detectedItems: file.detectedItems.map((i) => ({ ...i, status: "rejected" as ItemStatus })) });
  }

  function downloadRedacted() {
    if (!file) return;
    const link = document.createElement("a");
    link.href = file.fileDataUrl;
    link.download = file.name.replace(/\.[^.]+$/, "") + "-redacted.pdf";
    link.click();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 18 }}>
          <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Shield size={18} />
          </div>
          Redactor.app
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => router.push("/")}>Upload New</button>
          <button className="btn btn-primary" onClick={downloadRedacted}><Download size={16} /> Download</button>
        </div>
      </header>

      <main style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        {/* Page preview */}
        <div style={{ flex: 1, padding: 24, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Page {currentPage + 1} of {file.pages.length}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ padding: "6px 10px" }} onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>−</button>
              <span style={{ fontSize: 13, minWidth: 48, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button className="btn btn-secondary" style={{ padding: "6px 10px" }} onClick={() => setScale((s) => Math.min(3, s + 0.25))}>+</button>
            </div>
          </div>

          <div style={{ position: "relative", flex: 1, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#64748b20", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24 }}>
            <img
              src={page.imageDataUrl}
              alt={`Page ${currentPage + 1}`}
              style={{
                maxWidth: "100%",
                transform: `scale(${scale})`,
                transformOrigin: "top center",
                width: page.width * scale,
                height: page.height * scale,
              }}
            />
            {pageItems.filter((i) => i.status === "accepted").map((item) => (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  left: item.bbox.x * page.width * scale,
                  top: item.bbox.y * page.height * scale,
                  width: item.bbox.width * page.width * scale,
                  height: item.bbox.height * page.height * scale,
                  background: "rgba(239, 68, 68, 0.3)",
                  border: "2px solid #ef4444",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ padding: "6px 12px" }} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
              <ChevronLeft size={16} />
            </button>
            {file.pages.map((_pg, i) => (
              <span
                key={i}
                onClick={() => setCurrentPage(i)}
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: i === currentPage ? "#2563eb" : "#cbd5e1",
                  margin: "0 4px",
                  cursor: "pointer",
                }}
              />
            ))}
            <button className="btn btn-secondary" style={{ padding: "6px 12px" }} onClick={() => setCurrentPage((p) => Math.min(file.pages.length - 1, p + 1))} disabled={currentPage === file.pages.length - 1}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Items sidebar */}
        <div style={{ width: 320, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Detected ({file.detectedItems.length})</h3>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={acceptAll}>Accept All</button>
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={rejectAll}>Clear</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {file.pages.map((pg, pageIdx) => {
              const items = file.detectedItems.filter((i) => i.page === pageIdx + 1);
              if (items.length === 0) return null;
              return (
                <div key={pageIdx} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, fontWeight: 500 }}>PAGE {pageIdx + 1}</p>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        marginBottom: 6,
                        background: item.status === "accepted" ? "#fef2f2" : item.status === "rejected" ? "#f1f5f9" : "#fff",
                        border: item.status === "accepted" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>{item.type}</p>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</p>
                      </div>
                      <button
                        onClick={() => toggleItem(item.id)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: item.status === "accepted" ? "#ef4444" : "#e2e8f0",
                          color: item.status === "accepted" ? "white" : "#64748b",
                          flexShrink: 0,
                        }}
                      >
                        {item.status === "accepted" ? <X size={14} /> : <Check size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div style={{ padding: 16, borderTop: "1px solid #e2e8f0" }}>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={downloadRedacted}>
              <Download size={16} /> Download Redacted PDF
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>}>
      <ReviewContent />
    </Suspense>
  );
}