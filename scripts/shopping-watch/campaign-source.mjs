import { createHash } from "node:crypto";

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu(?:ta)?)\\.?";
const DAY = "\\d{1,2}(?:st|nd|rd|th)?";
const YEAR = "(?:[,\\s]+20\\d{2})?";
const MONTH_DATE = `${MONTH}\\s*${DAY}${YEAR}(?:\\s*[-–—]\\s*(?:${MONTH}\\s*)?${DAY}${YEAR})?`;
const DAY_MONTH_DATE = `${DAY}\\s*${MONTH}${YEAR}(?:\\s*[-–—]\\s*${DAY}\\s*${MONTH}${YEAR})?`;
const NUMERIC_DATE = "\\d{1,2}[./]\\d{1,2}(?:[./]20\\d{2}|\\.)?";
const SHORT_FINNISH_RANGE = `\\d{1,2}\\.\\s*[-–—]\\s*${NUMERIC_DATE}`;
const AMOUNT = "(?:\\d{1,3}(?:[ \\u00a0.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
const SIGNALS = new RegExp([
  `\\b20\\d{2}-\\d{1,2}-\\d{1,2}\\b`,
  `\\b${MONTH_DATE}`,
  `\\b${DAY_MONTH_DATE}`,
  `\\b${SHORT_FINNISH_RANGE}`,
  `\\b${NUMERIC_DATE}(?:\\s*[-–—]\\s*${NUMERIC_DATE})?`,
  `(?:€|\\bEUR)\\s*${AMOUNT}`,
  `${AMOUNT}\\s*(?:%|€|\\bEUR\\b)`,
  "\\b(?:black friday|black week|black month|cyber monday|halloween)\\b",
  "\\b(?:has ended|sale starts|starts on|begins on|sale ended|now live|on tullut päätökseensä|päättynyt|alkaa|käynnissä|voimassa)\\b",
].join("|"), "giu");

function decodedText(value) {
  return value.replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&euro;/gi, "€")
    .replace(/&(?:ndash|#8211);/gi, "–")
    .replace(/&(?:mdash|#8212);/gi, "—")
    .replace(/&(?:amp|#38);/gi, "&");
}

/** Keep explicit dates and offer values, never arbitrary page or countdown numbers. */
export function campaignSourceSignals(html) {
  if (typeof html !== "string") throw new TypeError("Campaign source must be an HTML string");
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<([a-z][\w:-]*)\b[^>]*(?:\b(?:class|id)\s*=\s*["'][^"']*count-?down[^"']*["']|\bdata-countdown\b)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const main = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] ?? cleaned;
  const text = decodedText(main.replace(/<[^>]+>/g, " ")).normalize("NFKC").replace(/\s+/g, " ");
  // Match whole date ranges before standalone values, preserving the day and year.
  // A countdown's bare 12:34:56 or "21 seconds" never enters these signals.
  return [...new Set([...text.matchAll(SIGNALS)].map(([signal]) => signal
    .toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim()))].sort();
}

export function campaignSourceHash(html) {
  return createHash("sha256").update(JSON.stringify(campaignSourceSignals(html))).digest("hex");
}
