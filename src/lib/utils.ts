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

  // Simple heuristic: if contains \frac, \sqrt, ^, _, \times, \div, etc.
  // or starts with a backslash
  const mathPatterns = [
    /\\frac/g, /\\sqrt/g, /\^/g, /_/g, /\\times/g, /\\div/g, /\\theta/g, /\\pi/g, 
    /\\alpha/g, /\\beta/g, /\\pm/g, /\\neq/g, /\\le/g, /\\ge/g, /\\approx/g,
    /\\sin/g, /\\cos/g, /\\tan/g, /\\log/g, /\\lim/g, /\\sum/g, /\\int/g
  ];

  let isMath = text.trim().startsWith("\\");
  if (!isMath) {
    for (const pattern of mathPatterns) {
      if (pattern.test(text)) {
        isMath = true;
        break;
      }
    }
  }

  // If it's effectively a math expression (even with spaces), wrap the whole thing
  // We'll be slightly more aggressive now: if it has math tokens, wrap unless it looks like regular prose (many spaces and long words)
  if (isMath) {
    const spaceCount = (text.match(/ /g) || []).length;
    const isProse = spaceCount > 5 || text.length > 50; 
    
    if (!isProse) {
      return `$${text.trim()}$`;
    }
  }

  return text;
}

export const normalizeMath = (s: string) => s.replace(/\s+/g, "").toLowerCase();
