// In-memory file store for the session
// Note: data is cleared when the browser tab/window is closed
import type { ProcessedFile } from "../../types";

const files = new Map<string, ProcessedFile>();

export function saveFile(file: ProcessedFile): void {
  files.set(file.id, file);
}

export function getFile(id: string): ProcessedFile | null {
  return files.get(id) ?? null;
}

export function getAllFiles(): ProcessedFile[] {
  return Array.from(files.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}