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

  // Regex to find potential LaTeX patterns:
  // 1. Commands: \frac, \sqrt, \alpha, etc.
  // 2. Symbols with braces or sub/sup: ^{...}, _{...}, ^2, _1
  // 3. Common symbols: \times, \div, \pm, \neq, \le, \ge, \approx, \pi, \theta
  
  // This regex looks for:
  // (a) backslash followed by letters and optional braced content: \\[a-zA-Z]+(\{.*?\})?
  // (b) backslash followed by a single special character or common symbol: \\[, \] \\( \\) \\{ \\} \\. \\, \\! \\; \\: \\ \/
  // (c) expressions like x^2, x_1, etc.
  
  // We'll use a safer approach: identify likely math segments and wrap them.
  // But a simpler and often more effective way for mixed text is to find sequences 
  // that look like math (contain \ or ^ or _) and wrap them if they don't have spaces,
  // or wrap the whole thing if it's mostly math.
  
// 1. Identify common LaTeX commands and structures
  // This includes \frac{...}{...}, \sqrt{...}, \times, \div, etc.
  // We look for patterns starting with a backslash and potentially followed by braced content.
  // Updated to handle double backslashes often coming from escaped JSON
  const mathRegex = /(\\\\[a-zA-Z]+|\\([a-zA-Z]+({[^}]*})*|[^a-zA-Z])|([a-zA-Z\d]+(\^|_){?[a-zA-Z\d]+}?))/g;

  if (mathRegex.test(text)) {
    // Reset regex index
    mathRegex.lastIndex = 0;

    return text.replace(mathRegex, (match) => {
      // If it contains Korean, leave it alone
      if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(match)) {
        return match;
      }
      
      // Clean up double backslashes to single ones for KaTeX
      let cleanMatch = match;
      if (match.startsWith('\\\\')) {
        cleanMatch = match.substring(1); // Keep one backslash
      }
      
      return `$${cleanMatch}$`;
    });
  }

  return text;
}

export const normalizeMath = (s: string) => s.replace(/\s+/g, "").toLowerCase();
