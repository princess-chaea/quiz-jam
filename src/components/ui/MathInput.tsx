"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn } from "@/lib/utils";
import { Keyboard } from "lucide-react";


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

const sanitizeLaTeX = (val: string) => {
  if (!val) return "";
  // Convert double backslashes (\\) to single (\) if followed by a LaTeX command char
  // This cleans up data that was over-escaped during generation or storage
  return val.replace(/\\\\(?=[a-zA-Z{}])/g, '\\');
};

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
  const lastValueRef = useRef<string>(value);
  const { openKeypad } = useMathKeypad();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Force mathlive import on mount
    import("mathlive").then(() => {
      setIsReady(true);
      if (mfRef.current) {
        // Use manual keyboard policy to prevent unwanted popups and allow hardware keyboard focus
        mfRef.current.mathVirtualKeyboardPolicy = "manual";
        
        // Add shortcuts for arithmetic symbols and SPACES
        mfRef.current.inlineShortcuts = {
          ...mfRef.current.inlineShortcuts,
          '*': { mode: 'math', value: '\\times' },
          '/': { mode: 'math', value: '\\div' },
          ' ': { mode: 'math', value: '\\ ' }
        };
        
        // Ensure initial value is set correctly
        const sanitized = sanitizeLaTeX(value);
        mfRef.current.value = sanitized || "";
        lastValueRef.current = sanitized || "";
      }
    });
  }, []);

  useEffect(() => {
    if (mfRef.current && template && !value) {
      mfRef.current.value = template;
      onChange(template);
    }
  }, [template, value, onChange]);

  // Sync value changes after initialization
  useEffect(() => {
    const sanitized = sanitizeLaTeX(value);
    if (isReady && mfRef.current && sanitized !== lastValueRef.current) {
      if (mfRef.current.value !== sanitized) {
        mfRef.current.value = sanitized || "";
      }
      lastValueRef.current = sanitized || "";
    }
  }, [value, isReady]);

  // Handle click outside to blur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!mfRef.current) return;
      const path = e.composedPath() as HTMLElement[];
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

    const handleInput = (e: Event) => {
      const newValue = (e.target as any).value;
      lastValueRef.current = newValue;
      onChange(newValue);
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
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
    };

    el.addEventListener("input", handleInput);
    el.addEventListener("change", handleInput);
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("focus", handleFocus);
    el.addEventListener("blur", handleInput);
    return () => {
      el.removeEventListener("input", handleInput);
      el.removeEventListener("change", handleInput);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("blur", handleInput);
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

  const sanitizedValue = sanitizeLaTeX(value);

  return (
    <div className={cn("relative w-full rounded-2xl overflow-hidden group/math bg-slate-50/50 border-2 border-slate-100 focus-within:border-indigo-400 focus-within:bg-white transition-all", containerClassName)}>
      <math-field
        ref={mfRef}
        className={cn("w-full p-4 text-lg font-bold outline-none", className)}
        style={{ 
          width: "100%", 
          minHeight: "100px",
          background: "transparent",
          border: "none"
        }}
        multiline="true"
        smart-mode="true"
        math-virtual-keyboard-policy="manual"
        placeholder={placeholder}
      >
        {sanitizedValue || ""}
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
