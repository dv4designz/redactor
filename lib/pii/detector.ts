// PII Detector — focused on names, identifiers, and trigger-word proximity
import type { DetectedItem } from "../../types";

let _id = 0;
function newId() { return `pii-${++_id}`; }

function makeItem(type: DetectedItem["type"], value: string, page: number, bbox: DetectedItem["bbox"], label?: string): DetectedItem {
  return { id: newId(), type, value, page, bbox, status: "pending", label };
}

// Find word index containing the given text
function findWordIdx(words: Array<{ text: string }>, text: string): number {
  const lower = text.toLowerCase();
  for (let i = 0; i < words.length; i++) {
    if (words[i].text.toLowerCase().includes(lower)) return i;
  }
  return -1;
}

// Check if a string looks like a name (not a common word/org)
function looksLikeName(s: string): boolean {
  const skip = /^(male|female|yes|no|unknown|none|address|phone|date|balance|total|amount|due|paid|claim|policy|member|group|company|office|clinic|hospital|medical|health|insurance|provider|service|center|care|healthcare|orthopedic|surgical|diagnostic|laboratory|pharmacy|allstate|progressive|state|farm|geico|liberty|geico|nationwide| Farmers|mercury|aarp|bluecross|united|humana|cigna| Aetna|axis|safeco|esurance|the|and|for|of|to|in|on|at|by|with|from|inc|llc|corp|assoc|group|com|org|llp|plc)$/i;
  return !skip.test(s) && /^[A-Z][a-z]/i.test(s) && s.length > 2;
}

export function detectPII(
  ocrText: string,
  words: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>,
  page: number
): DetectedItem[] {
  const items: DetectedItem[] = [];
  const lower = ocrText.toLowerCase();

  // --- SSN ---
  const ssnRe = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
  for (const m of ocrText.matchAll(ssnRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("SSN", m[0], page, bbox));
  }

  // --- Email ---
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  for (const m of ocrText.matchAll(emailRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("EMAIL", m[0], page, bbox));
  }

  // --- Phone ---
  const phoneRe = /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  for (const m of ocrText.matchAll(phoneRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("PHONE", m[0], page, bbox));
  }

  // --- Address ---
  const addrRe = /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+){1,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/gi;
  for (const m of ocrText.matchAll(addrRe)) {
    const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
    items.push(makeItem("ADDRESS", m[0], page, bbox));
  }

  // --- Trigger-word proximity: Name, Memo, Payee, Recipient, etc. ---
  // These label words precede the actual value on the same or adjacent line
  const nameTriggers = [
    // Primary name triggers
    "name:", "patient:", "insured:", "policyholder:", "member:", "claimant:",
    "borrower:", "driver:", "owner:", "holder:", "applicant:", "subscriber:",
    "enrollee:", "party:", "from:", "to:", "payee:", "recipient:", "beneficiary:",
    "authorized:", "account:", "memo:", "for:", "attention:", "attn:",
    // Common form label variations
    "patient name:", "insured name:", "policy holder:", "insured's name:",
    "driver's name:", "member name:", "claimant name:", "borrower's name:",
    "payee name:", "recipient name:", "holder name:", "owner name:",
    // Memo trigger — capture the whole memo field
    "memo:", "subject:", "re:", "regarding:", "description:",
    // Short forms often seen on checks/forms
    "name", "memo",
  ];

  for (const trigger of nameTriggers) {
    let idx = lower.indexOf(trigger);
    while (idx !== -1) {
      // Only treat "name" as trigger if it's isolated (not part of "email" etc.)
      if (trigger === "name" || trigger === "memo") {
        // Make sure it's actually a label — next char should be : or space or end
        const after = lower[idx + trigger.length];
        if (after !== ":" && after !== " " && after !== "\n" && after !== "\r") {
          idx = lower.indexOf(trigger, idx + 1);
          continue;
        }
      }

      const wi = findWordIdx(words, trigger);
      if (wi >= 0) {
        const triggerY = words[wi].bbox.y;
        const nameTokens: string[] = [];

        for (let j = wi + 1; j < Math.min(words.length, wi + 25); j++) {
          const w = words[j].text.trim();
          if (!w) break;
          // Stop at other label-like words or numbers that look like amounts/DOBs
          if (/^(date|claim|number|policy|account|address|phone|email|amount|total|balance|due|paid|sex|m|f| dob|ssn|#|check|routing|transit|invoice|amount|payment)$/i.test(w)) break;
          // Stop if y jumps significantly (new line)
          if (Math.abs(words[j].bbox.y - triggerY) > 0.06) break;
          // Stop if we hit a number that looks like a date or amount
          if (/^\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(w) && parseFloat(w.replace(/[$,]/g, "")) > 1000) break;
          nameTokens.push(w);
          if (nameTokens.length >= 6) break;
        }

        if (nameTokens.length >= 1) {
          const nameStr = nameTokens.join(" ").trim();
          // Skip pure numbers or obvious non-names
          if (nameStr.length > 2 && !/^\d+$/.test(nameStr) && !/^(yes|no|unknown|none)$/i.test(nameStr)) {
            // Build bbox from tokens
            const startBbox = words[wi + 1]?.bbox ?? words[wi].bbox;
            const endBbox = words[wi + nameTokens.length]?.bbox ?? startBbox;
            const bbox = mergeBbox(startBbox, endBbox);
            items.push(makeItem("NAME", nameStr, page, bbox, "trigger:" + trigger));
          }
        }
      }
      idx = lower.indexOf(trigger, idx + 1);
    }
  }

  // --- "For: Name" / "Re: Name" / "Attn: Name" ---
  const labelNameRe = /(?:for|attention|attn|re|subject|memo|via|dated)[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,4})/gi;
  for (const m of ocrText.matchAll(labelNameRe)) {
    const val = m[1]?.trim();
    if (val && val.length > 4 && looksLikeName(val.split(" ")[0])) {
      const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
      items.push(makeItem("NAME", val, page, bbox, "label_name"));
    }
  }

  // --- Policy/Member/Claim number followed by name ---
  const policyNameRe = /(?:policy|member|account|claim|group|policy\s*#|account\s*#|claim\s*#|group\s*#)[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)/gi;
  for (const m of ocrText.matchAll(policyNameRe)) {
    const val = m[1]?.trim();
    if (val && val.length > 4 && looksLikeName(val.split(" ")[0])) {
      const bbox = guessBbox(ocrText, m[0], m.index ?? 0, words);
      items.push(makeItem("NAME", val, page, bbox, "policy_name"));
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
  if (matching.length === 0) return { x: 0, y: 0, width: 0.08, height: 0.04 };
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