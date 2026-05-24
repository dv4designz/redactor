// Store files in memory for the session
const files = new Map<string, import("@/types").ProcessedFile>();

export function saveFile(file: import("@/types").ProcessedFile) {
  files.set(file.id, file);
}

export function getFile(id: string) {
  return files.get(id) ?? null;
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}