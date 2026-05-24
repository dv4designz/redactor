"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { Shield, Download, ChevronLeft, ChevronRight, Check, X, FileText, Plus, MousePointer, Square } from "lucide-react";
import { getAllFiles, getFile } from "../../lib/store/fileStore";
import type { ProcessedFile, DetectedItem } from "../../types";

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
  const [manualMode, setManualMode] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);

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
    setFile({ ...file, detectedItems: file.detectedItems.filter((i) => i.status === "rejected") });
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

  // Manual selection handlers
  const getImageCoords = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const imgEl = e.currentTarget.querySelector("img");
    if (!imgEl) return null;
    const rect = imgEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y, clientX: e.clientX, clientY: e.clientY };
  }, []);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode) return;
    const coords = getImageCoords(e);
    if (!coords) return;
    setSelecting(true);
    setSelectionStart(coords);
    setSelectionRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode || !selecting || !selectionStart) return;
    const coords = getImageCoords(e);
    if (!coords) return;
    setSelectionRect({
      x: Math.min(selectionStart.x, coords.x),
      y: Math.min(selectionStart.y, coords.y),
      width: Math.abs(coords.x - selectionStart.x),
      height: Math.abs(coords.y - selectionStart.y),
    });
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode || !selecting || !selectionRect || !file) return;
    setSelecting(false);
    // Only add if selection is meaningful (not a tiny accidental click)
    if (selectionRect.width < 0.005 || selectionRect.height < 0.005) {
      setSelectionRect(null);
      return;
    }
    // Add as a manual item
    const manualItem: DetectedItem = {
      id: `manual-${Date.now()}`,
      type: "NAME",
      value: "Manual selection",
      page: currentPage + 1,
      bbox: selectionRect,
      status: "pending",
      label: "manual",
    };
    setFile({ ...file, detectedItems: [...file.detectedItems, manualItem] });
    setSelectionRect(null);
  }

  function getStatusDot(status: ItemStatus) {
    if (status === "accepted") return "#ef4444";
    if (status === "rejected") return "#22c55e";
    return "#eab308";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "#2563eb", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Shield size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Redactor.app</span>
        </div>

        {/* Document switcher */}
        <div style={{ position: "relative" }}>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setShowDocList(!showDocList)}>
            <FileText size={12} /> {file.name.length > 25 ? file.name.slice(0, 23) + "..." : file.name}
          </button>
          {showDocList && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 240 }}>
              {allFiles.map((f) => (
                <div key={f.id} onClick={() => switchFile(f.id)} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", background: f.id === file.id ? "#eff6ff" : "transparent" }}>
                  <span style={{ fontSize: 12, fontWeight: f.id === file.id ? 600 : 400 }}>{f.name}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{f.pages.length}p</span>
                </div>
              ))}
              <div onClick={() => router.push("/dashboard")} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontSize: 12 }}>
                <Plus size={12} /> Upload new
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {/* Manual selection toggle */}
          <button
            className={`btn ${manualMode ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "5px 10px" }}
            onClick={() => { setManualMode(!manualMode); setSelectionRect(null); }}
            title="Click and drag to manually select areas to redact"
          >
            {manualMode ? <Square size={12} /> : <MousePointer size={12} />}
            {manualMode ? "Drawing..." : "Select"}
          </button>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => {
            const link = document.createElement("a");
            link.href = file.fileDataUrl;
            link.download = file.name.replace(/\.[^.]+$/, "") + "-redacted.pdf";
            link.click();
          }}>
            <Download size={12} /> Download ({acceptedCount})
          </button>
        </div>
      </header>

      <main style={{ display: "flex", height: "calc(100vh - 53px)" }}>
        {/* Page preview */}
        <div style={{ flex: 1, padding: 16, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Page {currentPage + 1} of {file.pages.length}</h2>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 11 }} onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>−</button>
              <span style={{ fontSize: 11, minWidth: 36, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 11 }} onClick={() => setScale((s) => Math.min(3, s + 0.25))}>+</button>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              flex: 1,
              overflow: "auto",
              border: `1px solid ${manualMode ? "#2563eb" : "#e2e8f0"}`,
              borderRadius: 8,
              background: "#64748b10",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: 12,
              cursor: manualMode ? "crosshair" : "default",
              userSelect: "none",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                src={page.imageDataUrl}
                alt={`Page ${currentPage + 1}`}
                style={{
                  maxWidth: "100%",
                  width: page.width * scale,
                  height: page.height * scale,
                  display: "block",
                  pointerEvents: "none",
                }}
                draggable={false}
              />

              {/* Redaction overlays */}
              {pageItems.map((item) => {
                const left = item.bbox.x * page.width * scale;
                const top = item.bbox.y * page.height * scale;
                const w = Math.max(item.bbox.width * page.width * scale, 8);
                const h = Math.max(item.bbox.height * page.height * scale, 6);
                if (left === 0 && top === 0 && w <= 8 && h <= 6) return null;

                const isAccepted = item.status === "accepted";
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: w,
                      height: h,
                      background: isAccepted ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.25)",
                      border: `2px solid ${isAccepted ? "#000" : item.status === "rejected" ? "#22c55e" : "#eab308"}`,
                      borderRadius: 2,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      pointerEvents: "auto",
                    }}
                    onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                    title={`${item.type}: ${item.value} [${item.status}]`}
                  />
                );
              })}

              {/* Manual selection rectangle */}
              {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: selectionRect.x * page.width * scale,
                    top: selectionRect.y * page.height * scale,
                    width: selectionRect.width * page.width * scale,
                    height: selectionRect.height * page.height * scale,
                    background: "rgba(37, 99, 235, 0.3)",
                    border: "2px solid #2563eb",
                    borderRadius: 2,
                    boxSizing: "border-box",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          {/* Page dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ padding: "3px 6px" }} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}><ChevronLeft size={13} /></button>
            {file.pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  border: "none",
                  background: i === currentPage ? "#2563eb" : "#cbd5e1",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <button className="btn btn-secondary" style={{ padding: "3px 6px" }} onClick={() => setCurrentPage((p) => Math.min(file.pages.length - 1, p + 1))} disabled={currentPage === file.pages.length - 1}><ChevronRight size={13} /></button>
          </div>
        </div>

        {/* Items sidebar */}
        <div style={{ width: 280, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>Detected Items</h3>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>{file.detectedItems.length} found · {acceptedCount} to redact</p>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 10 }} onClick={acceptAll}>All</button>
              <button className="btn btn-secondary" style={{ padding: "3px 7px", fontSize: 10 }} onClick={rejectAll}>None</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
            {file.pages.map((pg, pageIdx) => {
              const items = file.detectedItems.filter((i) => i.page === pageIdx + 1);
              if (items.length === 0) return null;
              return (
                <div key={pageIdx} style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 5, fontWeight: 600, letterSpacing: "0.05em" }}>PAGE {pageIdx + 1}</p>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { setCurrentPage(pageIdx); toggleItem(item.id); }}
                      style={{
                        padding: "7px 9px",
                        borderRadius: 6,
                        marginBottom: 3,
                        background: item.status === "accepted" ? "#fef2f2" : item.status === "rejected" ? "#f0fdf4" : "#fff",
                        border: `1px solid ${item.status === "accepted" ? "#fecaca" : item.status === "rejected" ? "#bbf7d0" : "#e2e8f0"}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: getStatusDot(item.status), flexShrink: 0 }} />
                          <p style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>{item.type}</p>
                          {item.label === "manual" && <span style={{ fontSize: 8, background: "#dbeafe", color: "#1d4ed8", padding: "1px 4px", borderRadius: 3 }}>manual</span>}
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</p>
                      </div>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: item.status === "accepted" ? "#ef4444" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: item.status === "accepted" ? "white" : "#94a3b8" }}>
                          <Check size={10} />
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: item.status === "rejected" ? "#22c55e" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: item.status === "rejected" ? "white" : "#94a3b8" }}>
                          <X size={10} />
                        </div>
                      </div>
                    </div>
                  ))}
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