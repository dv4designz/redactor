export interface DetectedItem {
  id: string;
  type: "NAME" | "ADDRESS" | "EMAIL" | "PHONE" | "DOB" | "SSN";
  value: string;
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
  status: "pending" | "accepted" | "rejected";
  label?: string;
}

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  imageDataUrl: string;
  textContent: string;
}

export interface ProcessedFile {
  id: string;
  name: string;
  fileDataUrl: string;
  pages: PDFPage[];
  detectedItems: DetectedItem[];
  createdAt: number;
}