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
  
  // Normalize common issues
  let processed = text.replace(/\\displaylines/g, '').trim();
  
  // 1. If it already has $, assume it's correctly formatted
  if (processed.includes("$")) return processed;

  // 2. Standard split by Korean characters for mixed inline text
  const parts = processed.split(/([ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+)/);
  
  return parts.map(part => {
    if (!part) return "";
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(part)) return part;
    
    // Markers: \ (backslash), ^ (sup), _ (sub), = (equals), \u25A1 (square), or brackets/braces often used in math
    // Added { } [ ] to the triggers
    if (/\\|\^|_|=|□|~|\{|\}|\[|\]/.test(part)) {
      // Normalize double backslashes (often from JSON escaping: \\frac -> \frac)
      let clean = part.replace(/\\\\/g, '\\');
      
      // If it's just punctuation/whitespace, don't wrap
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
          // Avoiding negative lookbehind for better cross-env compatibility
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
