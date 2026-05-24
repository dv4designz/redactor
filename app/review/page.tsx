"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Shield, Download, ChevronLeft, ChevronRight, Check, X, FileText, Plus } from "lucide-react";
import { getAllFiles, getFile } from "../../lib/store/fileStore";
import { ProcessedFile, DetectedItem } from "../../types";

type ItemStatus = "pending" | "accepted" | "rejected";

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId") ?? "";

  const [file, setFile] = useState<ProcessedFile | null>(null);
  const [allFiles, setAllFiles] = useState<ProcessedFile[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [showDocList, setShowDocList] = useState(false);

  useEffect(() => {
    const f = getFile(fileId);
    if (!f) { router.push("/dashboard"); return; }
    setFile(f);
    setAllFiles(getAllFiles());
  }, [fileId, router]);

  if (!file) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>;
  }

  const page = file.pages[currentPage] ?? file.pages[0];
  if (!page) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>No pages found</p></div>;
  }

  const pageItems = file.detectedItems.filter((i) => i.page === currentPage + 1);
  const acceptedCount = file.detectedItems.filter((i) => i.status === "accepted").length;

  function toggleItem(id: string) {
    if (!file) return;
    const updated = file.detectedItems.map((item) => {
      if (item.id !== id) return item;
      // Cycle: pending→accepted, accepted→rejected, rejected→pending
      const next: ItemStatus =
        item.status === "pending" ? "accepted" :
        item.status === "accepted" ? "rejected" : "pending";
      return { ...item, status: next };
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

  function switchFile(id: string) {
    setShowDocList(false);
    setCurrentPage(0);
    const f = getFile(id);
    if (f) {
      setFile(f);
      router.replace(`/review?fileId=${id}`);
    }
  }

  function goToDashboard() {
    router.push("/dashboard");
  }

  function getStatusColor(status: ItemStatus) {
    if (status === "accepted") return { bg: "#fef2f2", border: "#fecaca", icon: "#ef4444" };
    if (status === "rejected") return { bg: "#f1f5f9", border: "#e2e8f0", icon: "#94a3b8" };
    return { bg: "#fff", border: "#e2e8f0", icon: "#94a3b8" };
  }

  function getOverlayColor(status: ItemStatus) {
    if (status === "accepted") return "rgba(239, 68, 68, 0.35)";
    if (status === "rejected") return "rgba(34, 197, 94, 0.25)";
    return "rgba(234, 179, 8, 0.3)";
  }

  function getOverlayBorder(status: ItemStatus) {
    if (status === "accepted") return "#ef4444";
    if (status === "rejected") return "#22c55e";
    return "#eab308";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Shield size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Redactor.app</span>
        </div>

        {/* Document switcher */}
        <div style={{ position: "relative" }}>
          <button className="btn btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => setShowDocList(!showDocList)}>
            <FileText size={14} /> {file.name.length > 30 ? file.name.slice(0, 28) + "..." : file.name}
          </button>
          {showDocList && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 260 }}>
              {allFiles.map((f) => (
                <div key={f.id} onClick={() => switchFile(f.id)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", background: f.id === file.id ? "#eff6ff" : "transparent" }}>
                  <span style={{ fontSize: 13, fontWeight: f.id === file.id ? 600 : 400 }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{f.pages.length}p · {f.detectedItems.length} items</span>
                </div>
              ))}
              <div onClick={goToDashboard} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontSize: 13 }}>
                <Plus size={14} /> Upload new
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={goToDashboard}>
            <Plus size={14} /> New
          </button>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => {
            const link = document.createElement("a");
            link.href = file.fileDataUrl;
            link.download = file.name.replace(/\.[^.]+$/, "") + "-redacted.pdf";
            link.click();
          }}>
            <Download size={14} /> Download ({acceptedCount})
          </button>
        </div>
      </header>

      <main style={{ display: "flex", height: "calc(100vh - 57px)" }}>
        {/* Page preview */}
        <div style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Page {currentPage + 1} of {file.pages.length}</h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>−</button>
              <span style={{ fontSize: 12, minWidth: 40, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setScale((s) => Math.min(3, s + 0.25))}>+</button>
            </div>
          </div>

          <div style={{ position: "relative", flex: 1, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                src={page.imageDataUrl}
                alt={`Page ${currentPage + 1}`}
                style={{
                  maxWidth: "100%",
                  width: page.width * scale,
                  height: page.height * scale,
                  display: "block",
                }}
              />
              {/* Redaction overlays */}
              {pageItems.map((item) => {
                const left = item.bbox.x * page.width * scale;
                const top = item.bbox.y * page.height * scale;
                const w = item.bbox.width * page.width * scale;
                const h = item.bbox.height * page.height * scale;
                if (left === 0 && top === 0 && w === 0 && h === 0) return null;
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: w,
                      height: h,
                      background: getOverlayColor(item.status),
                      border: `2px solid ${getOverlayBorder(item.status)}`,
                      borderRadius: 2,
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                    onClick={() => toggleItem(item.id)}
                    title={`${item.type}: ${item.value} [${item.status}]`}
                  />
                );
              })}
            </div>
          </div>

          {/* Page dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}><ChevronLeft size={14} /></button>
            {file.pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "none",
                  background: i === currentPage ? "#2563eb" : "#cbd5e1",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCurrentPage((p) => Math.min(file.pages.length - 1, p + 1))} disabled={currentPage === file.pages.length - 1}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Items sidebar */}
        <div style={{ width: 300, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Detected Items</h3>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>{file.detectedItems.length} found · {acceptedCount} to redact</p>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 11 }} onClick={acceptAll}>All</button>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 11 }} onClick={rejectAll}>None</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {file.pages.map((pg, pageIdx) => {
              const items = file.detectedItems.filter((i) => i.page === pageIdx + 1);
              if (items.length === 0) return null;
              return (
                <div key={pageIdx} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>PAGE {pageIdx + 1}</p>
                  {items.map((item) => {
                    const colors = getStatusColor(item.status);
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          marginBottom: 4,
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => toggleItem(item.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 1 }}>{item.type} {item.status !== "pending" && `· ${item.status}`}</p>
                          <p style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</p>
                        </div>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 4, background: item.status === "accepted" ? "#ef4444" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: item.status === "accepted" ? "white" : "#94a3b8" }}>
                            <Check size={12} />
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: 4, background: item.status === "rejected" ? "#22c55e" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: item.status === "rejected" ? "white" : "#94a3b8" }}>
                            <X size={12} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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