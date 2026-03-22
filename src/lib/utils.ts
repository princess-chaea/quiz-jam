import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateQuizCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

export function getChoseong(str: string) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code > -1 && code < 11172) {
      return CHOSEONG[Math.floor(code / 588)];
    }
    return char;
  }).join('');
}

/**
 * Wraps LaTeX patterns with $ delimiters if not already wrapped.
 * This helps remark-math recognize the math blocks.
 */
export function processMathText(text: string | null | undefined): string {
  if (!text) return "";
  
  // 1. Deduplicate excessive consecutive braces (e.g., {{{ -> {)
  // This addresses the issue where AI or copy-pasting results in triple braces
  let processed = text.replace(/[{]{3,}/g, '{').replace(/[}]{3,}/g, '}');
  
  // Normalize common issues
  processed = processed.replace(/\\displaylines/g, '').trim();
  
  // 2. If it already has $, assume it's correctly formatted
  if (processed.includes("$")) return processed;

  // 3. Standard split by Korean characters for mixed inline text
  const parts = processed.split(/([ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+)/);
  
  return parts.map(part => {
    if (!part) return "";
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(part)) return part;
    
    // Markers: \ (backslash), ^ (sup), _ (sub), = (equals), \u25A1 (square), or brackets/braces often used in math
    // Refined trigger logic: only wrap if it looks like actual math content
    if (/\\|\^|_|=|□|~|\{|\}|\[|\]|\//.test(part)) {
      // Normalize double backslashes (often from JSON escaping: \\frac -> \frac)
      let clean = part.replace(/\\\\/g, '\\');
      
      // If it's just punctuation/whitespace or standalone braces with nothing else, don't wrap
      if (!/[a-zA-Z0-9\\^_{}=\[\]□]/.test(clean.trim())) return part;

      const leadingSpace = part.match(/^\s*/)?.[0] || "";
      const trailingSpace = part.match(/\s*$/)?.[0] || "";
      
      const trimmed = clean.trim();
      // Split by trailing punctuation to keep it outside $
      const match = trimmed.match(/^(.*?)(\s*[.,?!]*)$/);
      
      if (match) {
        let mathPart = match[1].trim();
        const punctuationPart = match[2];
        if (mathPart) {
          // Preserve internal spaces in math mode by escaping them
          const escapedMath = mathPart.split(' ').map(s => s || '').join('\\ ');
          return `${leadingSpace}$${escapedMath}$${punctuationPart}${trailingSpace}`;
        }
      }
      
      const escapedClean = trimmed.split(' ').map(s => s || '').join('\\ ');
      return `${leadingSpace}$${escapedClean}$${trailingSpace}`;
    }
    
    return part;
  }).join('');
}

export const normalizeMath = (s: string) => s.replace(/[\s{}]+/g, "").toLowerCase();
