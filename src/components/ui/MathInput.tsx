"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn } from "@/lib/utils";
import { Keyboard } from "lucide-react";

/**
 * Converts plain text or mixed LaTeX into a format that MathLive renders correctly,
 * specifically preserving spaces and Korean characters.
 */
const toMathLiveValue = (text: string) => {
  if (!text) return "";
  
  // 1. Normalize double backslashes (\\) to single (\) if followed by a LaTeX command char
  let result = text.replace(/\\\\(?=[a-zA-Z{}])/g, '\\');
  
  // 2. Preserve spaces and arithmetic symbols by escaping them for MathLive
  // If it's already LaTeX, we only escape spaces that aren't preceded by \
  try {
    // Escape arithmetic symbols if they aren't already preceded by \
    // result = result.replace(/(?<!\\)([+\-=><*/])/g, '\\$1 ');
    
    // Most importantly, ensure spaces are converted to LaTeX spaces (\ )
    result = result.replace(/(?<!\\) /g, '\\ ');
  } catch (e) {
    // Simple fallback: replace space if not preceded by backslash
    result = result.replace(/([^\\]) /g, '$1\\ ');
    // Handle leading space
    if (result.startsWith(' ')) result = '\\ ' + result.slice(1);
  }
  
  return result;
};

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  placeholder?: string;
  template?: string;
  level?: 'elementary' | 'middle' | 'high';
  isTeacher?: boolean;
  containerClassName?: string;
}

export function MathInput({ 
  value, 
  onChange, 
  onEnter, 
  className = "", 
  placeholder, 
  template, 
  level = 'elementary',
  isTeacher = false,
  containerClassName = ""
}: MathInputProps) {
  const mfRef = useRef<any>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const { openKeypad } = useMathKeypad();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Force mathlive import on mount
    import("mathlive").then((mathlive) => {
      setIsReady(true);
      if (mfRef.current) {
        // Use manual keyboard policy to allow hardware keyboard focus and avoid auto-popups
        mfRef.current.mathVirtualKeyboardPolicy = "manual";
        
        // Add shortcuts for arithmetic symbols and SPACES
        mfRef.current.inlineShortcuts = {
          ...mfRef.current.inlineShortcuts,
          '*': { mode: 'math', value: '\\times' },
          '/': { mode: 'math', value: '\\div' },
          ' ': { mode: 'math', value: '\\ ' }
        };

        // Enable smart mode to better handle mixed text/math
        mfRef.current.smartMode = true;
      }
    });
  }, []);

  useEffect(() => {
    if (mfRef.current && template && !value) {
      const prepared = toMathLiveValue(template);
      mfRef.current.value = prepared;
      lastValueRef.current = template;
      onChange(template);
    }
  }, [template, value, onChange]);

  // Sync value changes after initialization
  useEffect(() => {
    if (!isReady || !mfRef.current) return;
    
    // Only update mfRef.current.value if it's the first time or meaningfully different
    // to prevent cursor jumping or blocking input
    if (lastValueRef.current === undefined || value !== lastValueRef.current) {
      const prepared = toMathLiveValue(value);
      if (mfRef.current.value !== prepared) {
        mfRef.current.value = prepared || "";
      }
      lastValueRef.current = value;
    }
  }, [value, isReady]);

  // Handle click outside to blur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!mfRef.current) return;
      const path = (e.composedPath?.() || []) as HTMLElement[];
      const isInsideMf = path.includes(mfRef.current);
      const isInsideKeypad = path.some(el => el.classList?.contains('math-keypad-container'));
      const isKeyboardClick = path.some(el => el.classList?.contains('ML__keyboard'));
      
      if (!isInsideMf && !isInsideKeypad && !isKeyboardClick) {
        mfRef.current?.blur?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, []);

  useEffect(() => {
    const el = mfRef.current;
    if (!el) return;

    const handleUpdate = (e: Event) => {
      // Use getValue() for more reliability 
      const liveValue = el.getValue?.() || el.value || "";
      
      // CRITICAL: Convert LaTeX spaces (\ ) back to regular spaces for the parent state.
      // This ensures that Text Mode sees normal spaces, and then toMathLiveValue 
      // converts them back to \  for the math-field.
      const normalizedValue = liveValue.replace(/\\ /g, ' ');
      
      lastValueRef.current = normalizedValue; 
      onChange(normalizedValue);
    };

    const handleFocus = () => {
      if (!isTeacher) {
        if (typeof el.executeCommand === 'function') {
          openKeypad(el, level);
        } else {
          setTimeout(() => {
            if (typeof el.executeCommand === 'function') {
              openKeypad(el, level);
            }
          }, 100);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        // Explicitly handle space to insert a LaTeX space command
        e.preventDefault();
        if (typeof el.executeCommand === 'function') {
            el.executeCommand(["insert", "\\ "]);
            // Manually trigger update since we prevented default
            handleUpdate(e);
        }
        return;
      }
      
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
    };

    // Use 'input' for real-time updates and 'change' for finality
    el.addEventListener("input", handleUpdate);
    el.addEventListener("change", handleUpdate);
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("focus", handleFocus);
    el.addEventListener("blur", handleUpdate);
    
    return () => {
      el.removeEventListener("input", handleUpdate);
      el.removeEventListener("change", handleUpdate);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("blur", handleUpdate);
    };
  }, [onChange, onEnter, openKeypad, level, isTeacher]);

  const handleToggleKeyboard = () => {
    // @ts-ignore
    if (window.mathVirtualKeyboard) {
      // @ts-ignore
      if (window.mathVirtualKeyboard.visible) {
        // @ts-ignore
        window.mathVirtualKeyboard.hide();
      } else {
        // @ts-ignore
        window.mathVirtualKeyboard.show();
      }
    }
  };

  if (!isReady || !mounted) {
    return (
      <div className={cn("relative w-full rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center min-h-[100px]", containerClassName)}>
         <div className="flex flex-col items-center gap-2">
           <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
           <p className="text-[10px] font-bold text-slate-400 italic">수식 편집기 로드 중...</p>
         </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full rounded-2xl overflow-hidden group/math bg-slate-50/50 border-2 border-slate-100 focus-within:border-indigo-400 focus-within:bg-white transition-all", containerClassName)}>
      <math-field
        ref={mfRef}
        className={cn("w-full p-4 text-lg font-bold outline-none", className)}
        style={{ 
          width: "100%", 
          minHeight: "100px",
          background: "transparent",
          border: "none",
          fontSize: "1.25rem"
        }}
        multiline="true"
        math-virtual-keyboard-policy="manual"
        placeholder={placeholder}
      >
        {toMathLiveValue(value)}
      </math-field>
      
      <div className="absolute right-3 top-3 flex gap-2 opacity-0 group-hover/math:opacity-100 transition-opacity">
         <button 
          type="button"
          onClick={handleToggleKeyboard}
          className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-500 hover:border-indigo-200 shadow-sm transition-all"
          title="가상 키보드"
        >
          <Keyboard size={16} />
        </button>
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-1 opacity-40 group-hover/math:opacity-100 transition-all pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">수식 모드</span>
      </div>
    </div>
  );
}
