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
  
  // Let's use a regex that matches LaTeX commands and their immediate surroundings
  const mathRegex = /(\\[a-zA-Z]+(\{.*?\})?|[\d\w](\^|_)\{?.*?\}?|\\(times|div|pm|neq|le|ge|approx|pi|theta|alpha|beta|gamma|delta|sigma|omega|lambda|sqrt|frac))/g;

  if (mathRegex.test(text)) {
    // If it looks like a single math expression (no or few spaces), wrap the whole thing
    const spaceCount = (text.match(/ /g) || []).length;
    if (spaceCount < 3) {
      return `$${text.trim()}$`;
    }
    
    // For mixed text, we try to wrap recognized LaTeX bits
    // This is tricky. A better way: if it contains any common LaTeX commands, 
    // and it's not already wrapped, let's see if we can just wrap the whole thing 
    // but ONLY if it's mostly math.
    
    // Actually, for the AI generator, it usually gives "What is \frac{1}{2}?"
    // If we wrap the whole thing, it becomes "$What is \frac{1}{2}$", which renders text as math (italics).
    // So we should try to wrap ONLY the LaTeX part.
    
    return text.replace(/(\\[a-zA-Z]+\{.*?\}|(\\[a-zA-Z]+)|[\w\d](\^|_)\{?.*?\}?|[\w\d](\^|_)[\w\d])/g, (match) => {
      // Don't wrap if it's just a common word that happens to match (though backslash usually prevents this)
      return `$${match}$`;
    });
  }

  return text;
}

export const normalizeMath = (s: string) => s.replace(/\s+/g, "").toLowerCase();
