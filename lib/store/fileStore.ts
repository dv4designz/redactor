// Store files in localStorage for persistence across page refreshes
import type { ProcessedFile } from "../../types";

const KEY = "redactor_files";

export function saveFile(file: ProcessedFile) {
  const files = getAllFiles();
  const idx = files.findIndex((f) => f.id === file.id);
  if (idx >= 0) {
    files[idx] = file;
  } else {
    files.push(file);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(files));
  } catch (e) {
    // Storage full — remove oldest files
    const trimmed = files.slice(files.length > 5 ? files.length - 5 : 0);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  }
}

export function getFile(id: string): ProcessedFile | null {
  const files = getAllFiles();
  return files.find((f) => f.id === id) ?? null;
}

export function getAllFiles(): ProcessedFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}