"use client";

import { useState } from "react";
import { Shield, Upload, FileText, AlertCircle } from "lucide-react";

export default function HomePage() {
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      alert("Please upload a PDF or image file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    // Store in localStorage via a data URL approach for demo
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("uploadedFile", JSON.stringify({
        name: file.name,
        dataUrl: reader.result,
        type: file.type,
      }));
      window.location.href = "/dashboard";
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 540 }}>
        <div style={{ width: 64, height: 64, background: "#2563eb", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "white" }}>
          <Shield size={32} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Redactor.app</h1>
        <p style={{ fontSize: 18, color: "#64748b", marginBottom: 40 }}>
          Automatically detect and redact PII in medical documents. 100% client-side — your files never leave your device.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          style={{
            border: `2px dashed ${dragOver ? "#2563eb" : "#e2e8f0"}`,
            borderRadius: 16,
            padding: "48px 24px",
            background: dragOver ? "#eff6ff" : "white",
            transition: "all 0.2s",
            cursor: "pointer",
            marginBottom: 24,
          }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,image/*";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
        >
          <Upload size={40} style={{ marginBottom: 16, color: "#94a3b8" }} />
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Drop your file here, or <span style={{ color: "#2563eb" }}>browse</span>
          </p>
          <p style={{ fontSize: 14, color: "#94a3b8" }}>PDF or image (JPG, PNG)</p>
        </div>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" }}><FileText size={16} style={{ color: "#2563eb" }} />Scanned PDFs</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" }}><Shield size={16} style={{ color: "#2563eb" }} />Names &amp; Addresses</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" }}><AlertCircle size={16} style={{ color: "#2563eb" }} />SSN &amp; DOB</div>
        </div>
      </div>
    </div>
  );
}