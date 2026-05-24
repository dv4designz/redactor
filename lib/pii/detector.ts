// PII Detector — focused on names, identifiers, and trigger-word proximity
import type { DetectedItem } from "../../types";

let _id = 0;
function newId() { return `pii-${++_id}`; }

function makeItem(type: DetectedItem["type"], value: string, page: number, bbox: DetectedItem["bbox"], label?: string): DetectedItem {
  return { id: newId(), type, value, page, bbox, status: "pending", label };
}

// Find the index of a word in the words array that contains or matches the given text
function findWordIdx(words: Array<{ text: string }>, text: string, startIdx = 0): number {
  const lower = text.toLowerCase();
  for (let i = startIdx; i < words.length; i++) {
    if (words[i].text.toLowerCase().includes(lower)) return i;
  }
  return -1;
}

export function detectPII(
  ocrText: string,
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>,
  page: number
): DetectedItem[] {
  const items: DetectedItem[] = [];
  const lower = ocrText.toLowerCase();

  // --- 1. SSN ---
  const ssnRe = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
  for (const m of ocrText.matchAll(ssnRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("SSN", m[0], page, bbox));
  }

  // --- 2. Email ---
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  for (const m of ocrText.matchAll(emailRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("EMAIL", m[0], page, bbox));
  }

  // --- 3. Phone ---
  const phoneRe = /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  for (const m of ocrText.matchAll(phoneRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("PHONE", m[0], page, bbox));
  }

  // --- 4. Address ---
  const addrRe = /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+){1,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/gi;
  for (const m of ocrText.matchAll(addrRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("ADDRESS", m[0], page, bbox));
  }

  // --- 5. NAME: Trigger-word proximity (Name:, Patient:, Insured:, Member:, etc.) ---
  // These label words typically appear on the SAME LINE or adjacent line as the name
  const nameTriggers = [
    "name:", "patient:", "insured:", "member:", "policyholder:",
    "claimant:", "borrower:", "driver:", "owner:", "holder:",
    "applicant:", "subscriber:", "enrollee:", "party:", "from:",
  ];

  for (const trigger of nameTriggers) {
    let triggerIdx = lower.indexOf(trigger);
    while (triggerIdx !== -1) {
      // Find this trigger word in the words array
      const wi = findWordIdx(words, trigger, 0);
      if (wi >= 0) {
        // Collect name tokens after this trigger
        // Look in a window of ~15 tokens after the trigger
        const nameTokens: string[] = [];
        const triggerY = words[wi].bbox.y;

        for (let j = wi + 1; j < Math.min(words.length, wi + 20); j++) {
          const w = words[j].text.trim();
          if (!w) break;
          // Stop if we hit another label-like word
          if (/^(date|claim|number|policy|account|address|phone|email|amount|total|balance|due|paid|sex|m|f| dob|ssn|#)$/i.test(w)) break;
          // Stop if y changes too much (new line)
          if (Math.abs(words[j].bbox.y - triggerY) > 0.05) break;
          nameTokens.push(w);
          if (nameTokens.length >= 4) break; // max 4 tokens for name
        }

        if (nameTokens.length >= 2) {
          const nameStr = nameTokens.join(" ");
          // Skip if it looks like a date, amount, or organization
          if (!/^\d|^\$|inc|llc|corp|assoc|group|com|org$/i.test(nameStr) && nameStr.length > 4) {
            const startBbox = words[wi + 1]?.bbox ?? words[wi].bbox;
            const endBbox = words[wi + nameTokens.length]?.bbox ?? startBbox;
            const bbox = mergeBbox(startBbox, endBbox);
            items.push(makeItem("NAME", nameStr, page, bbox, "trigger"));
          }
        }
      }
      triggerIdx = lower.indexOf(trigger, triggerIdx + 1);
    }
  }

  // --- 6. NAME: "For: Name" pattern (common in form headers) ---
  const forNameRe = /(?:for|attention|attn|to)[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})/gi;
  for (const m of ocrText.matchAll(forNameRe)) {
    if (m[1] && m[1].length > 4) {
      const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
      items.push(makeItem("NAME", m[1].trim(), page, bbox, "for_label"));
    }
  }

  // --- 7. NAME: Policy/Member number + adjacent name patterns ---
  const policyNameRe = /(?:policy|member|account|claim|group)\s*(?:#|number|no\.?)?[:\s]*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)/gi;
  for (const m of ocrText.matchAll(policyNameRe)) {
    const val = m[1]?.trim();
    if (val && val.length > 4 && !/^(?:number|no\.?)$/i.test(val)) {
      const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
      items.push(makeItem("NAME", val, page, bbox, "policy_label"));
    }
  }

  // --- 8. NAME: Proximity fallback — look for name tokens near any trigger word ---
  // If we found a trigger word but couldn't get a name, try adjacent tokens
  if (items.length === 0) {
    const nameTokenRe = /\b([A-Z][a-z]{1,15}(?:\s+[A-Z][a-z]{1,15}){1,3})\b/g;
    for (const m of ocrText.matchAll(nameTokenRe)) {
      const val = m[1]?.trim();
      if (!val) continue;
      // Skip common non-name patterns
      if (/^(male|female|yes|no|unknown|none|address|phone|date|name|balance|total|amount|due|paid|claim|policy|member|group|company|office|clinic|hospital|medical|health|insurance|provider|service|center|care|healthcare|orthopedic|surgical|diagnostic|laboratory|pharmacy)$/i.test(val)) continue;
      const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
      items.push(makeItem("NAME", val, page, bbox, "proximity"));
    }
  }

  return items;
}

function guessBbox(
  text: string,
  match: string,
  index: number,
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>
): DetectedItem["bbox"] {
  const context = text.slice(index, index + match.length);
  const matching = words.filter((w) => context.includes(w.text));
  if (matching.length === 0) return { x: 0, y: 0, width: 0.1, height: 0.04 };
  const first = matching[0].bbox;
  const last = matching[matching.length - 1].bbox;
  return {
    x: first.x,
    y: first.y,
    width: Math.max(last.x + last.width - first.x, first.width),
    height: Math.max(first.height, last.height),
  };
}

function mergeBbox(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): DetectedItem["bbox"] {
  return {
    x: a.x,
    y: a.y,
    width: Math.max(b.x + b.width - a.x, a.width),
    height: Math.max(a.height, b.height),
  };
}