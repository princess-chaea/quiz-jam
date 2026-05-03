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
  const isKorean = (c: string) => {
    const code = c.charCodeAt(0) - 0xAC00;
    return code > -1 && code < 11172;
  };
  const isAlpha = (c: string) => /^[a-zA-Z0-9]$/.test(c);

  return str.split('').map((char, i) => {
    if (isKorean(char)) {
      const code = char.charCodeAt(0) - 0xAC00;
      return CHOSEONG[Math.floor(code / 588)];
    }
    if (isAlpha(char)) {
      // Reveal only the first character for English/Alphanumeric strings
      return i === 0 ? char : "?";
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

// 4. Check if text contains math-specific symbols or LaTeX commands
export function hasMathSymbols(text: string | null | undefined): boolean {
  if (!text) return false;
  // Refined Patterns: \ (backslash for commands), ^ (sup), _ (sub), □ (square), 
  // Braces {}, and dedicated math unicode ranges. 
  // Excluded: ~, /, *, =, [, ] as they are common in general text or handled by standard typing.
  return /\\|\^|_|□|\{|\}|[\u2200-\u22FF]|[\u2700-\u27BF]/.test(text);
}

export const normalizeMath = (s: string) => {
  if (!s) return "";
  // 1. Convert to lowercase
  // 2. Remove all whitespace (\s), LaTeX non-breaking spaces (~), curly braces {}, common punctuation
  // NOTE: MathLive encodes spaces as ~ in LaTeX (e.g. "1 1/8" → "1~\frac{1}{8}").
  //       We must strip ~ so that "1~\frac{1}{8}" and "1\frac{1}{8}" compare as equal.
  return s.toLowerCase().replace(/[\s~{}.,?!]+/g, "");
};
