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
  
  // Strip \displaylines and any double backslashes before processing
  text = text.replace(/\\displaylines/g, '').trim();
  
  // 1. If it already has $, assume it's correctly formatted
  if (text.includes("$")) return text;

  // 2. Detect if this is likely a single LaTeX block from MathLive (e.g. multi-line or complex formatting)
  // Hallmarks: starts with \displaylines, contains \frac, \begin, etc. and lacks clear Korean delimiters outside commands
  const isBlockMath = text.includes("\\displaylines") || 
                     text.includes("\\begin{") || 
                     (text.includes("\\frac") && text.length > 50);

  if (isBlockMath) {
    // For block math, we wrap the entire string once to avoid breaking internal commands
    return `$${text.trim()}$`;
  }

  // 3. Standard split by Korean characters for mixed inline text
  const parts = text.split(/([ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+)/);
  
  return parts.map(part => {
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(part)) return part;
    
    // Markers: \ (backslash), ^ (sup), _ (sub), = (equals), \u25A1 (square), or ~ (space)
    if (/\\|\^|_|=|□|~/.test(part)) {
      // Normalize double backslashes (often from JSON escaping)
      let clean = part.replace(/\\\\(?=[a-zA-Z{}])/g, '\\');
      
      if (!/[a-zA-Z0-9\\^_{}=□]/.test(clean)) return part;

      const leadingSpace = part.match(/^\s*/)?.[0] || "";
      const trailingSpace = part.match(/\s*$/)?.[0] || "";
      
      const match = clean.trim().match(/^(.*?)(\s*[.,?!]*)$/);
      if (match) {
        let mathPart = match[1].trim();
        const punctuationPart = match[2];
        if (mathPart) {
          // Preserve internal spaces in math mode by escaping them, but avoid double escaping
          const escapedMath = mathPart.replace(/(?<!\\) /g, '\\ ');
          return `${leadingSpace}$${escapedMath}$${punctuationPart}${trailingSpace}`;
        }
      }
      
      const escapedClean = clean.trim().replace(/(?<!\\) /g, '\\ ');
      return `${leadingSpace}$${escapedClean}$${trailingSpace}`;
    }
    
    return part;
  }).join('');
}

export const normalizeMath = (s: string) => s.replace(/\s+/g, "").toLowerCase();
