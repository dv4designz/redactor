// PII Detector — finds names, addresses, SSNs, etc. in OCR text
import { DetectedItem } from "../../types";

const SSN_PATTERN = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_PATTERN = /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const DOB_PATTERN = /\b(?:DOB|Date\s*of\s*Birth|DoB)[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi;
const ADDRESS_PATTERN = /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+){1,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/gi;
const NAME_LABEL_PATTERN = /\b(?:Patient|Name|Member|Borrower|Insured|Claimant|Policy\s*Holder)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi;

let _id = 0;
function newId() { return `pii-${++_id}`; }

function makeItem(type: DetectedItem["type"], value: string, page: number, bbox: DetectedItem["bbox"], label?: string): DetectedItem {
  return { id: newId(), type, value, page, bbox, status: "pending", label };
}

export function detectPII(
  ocrText: string,
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>,
  page: number
): DetectedItem[] {
  const items: DetectedItem[] = [];

  // SSNs
  let m;
  while ((m = SSN_PATTERN.exec(ocrText)) !== null) {
    const bbox = guessBbox(ocrText, m[0], m.index, words);
    items.push(makeItem("SSN", m[0], page, bbox));
  }

  // Emails
  while ((m = EMAIL_PATTERN.exec(ocrText)) !== null) {
    const bbox = guessBbox(ocrText, m[0], m.index, words);
    items.push(makeItem("EMAIL", m[0], page, bbox));
  }

  // Phones
  while ((m = PHONE_PATTERN.exec(ocrText)) !== null) {
    const bbox = guessBbox(ocrText, m[0], m.index, words);
    items.push(makeItem("PHONE", m[0], page, bbox));
  }

  // Addresses
  ADDRESS_PATTERN.lastIndex = 0;
  while ((m = ADDRESS_PATTERN.exec(ocrText)) !== null) {
    const bbox = guessBbox(ocrText, m[0], m.index, words);
    items.push(makeItem("ADDRESS", m[0], page, bbox));
  }

  // Names with labels
  NAME_LABEL_PATTERN.lastIndex = 0;
  while ((m = NAME_LABEL_PATTERN.exec(ocrText)) !== null) {
    const bbox = guessBbox(ocrText, m[0], m.index, words);
    items.push(makeItem("NAME", m[1].trim(), page, bbox, "labeled"));
  }

  return items;
}

function guessBbox(
  text: string,
  match: string,
  index: number,
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>
): DetectedItem["bbox"] {
  // Find words that are within the match region
  const context = text.slice(index, index + match.length);
  const matching = words.filter((w) => context.includes(w.text));
  if (matching.length === 0) return { x: 0, y: 0, width: 0.1, height: 0.05 };
  const first = matching[0].bbox;
  const last = matching[matching.length - 1].bbox;
  return {
    x: first.x,
    y: first.y,
    width: Math.max(last.x + last.width - first.x, first.width),
    height: Math.max(first.height, last.height),
  };
}