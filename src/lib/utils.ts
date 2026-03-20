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
  
  // If it already has $, assume it's correctly formatted
  if (text.includes("$")) return text;

  // Split by blocks of Korean characters to isolate potential math segments
  const parts = text.split(/([ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+)/);
  
  return parts.map(part => {
    // If it's a Korean segment, return as is
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(part)) return part;
    
    // Part is non-Korean. Let's check for math markers:
    // Markers: \ (backslash), ^ (sup), _ (sub), = (equals), or \u25A1 (square)
    if (/\\|\^|_|=|□/.test(part)) {
      // Normalize double backslashes (often from JSON escaping)
      let clean = part.replace(/\\\\(?=[a-zA-Z{}])/g, '\\');
      
      // If the segment consists only of whitespace/punctuation, don't wrap
      if (!/[a-zA-Z0-9\\^_{}=□]/.test(clean)) return part;

      // Check for leading and trailing whitespace to preserve it
      const leadingSpace = part.match(/^\s*/)?.[0] || "";
      const trailingSpace = part.match(/\s*$/)?.[0] || "";
      
      // Check for trailing punctuation (.,?!) to keep it outside the math block
      const match = clean.trim().match(/^(.*?)(\s*[.,?!]*)$/);
      if (match) {
        const mathPart = match[1].trim();
        const punctuationPart = match[2];
        if (mathPart) {
          return `${leadingSpace}$${mathPart}$${punctuationPart}${trailingSpace}`;
        }
      }
      
      return `${leadingSpace}$${clean.trim()}$${trailingSpace}`;
    }
    
    // No math markers found in this non-Korean segment
    return part;
  }).join('');
}

export const normalizeMath = (s: string) => s.replace(/\s+/g, "").toLowerCase();
