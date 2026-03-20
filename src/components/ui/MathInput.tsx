"use client";

import React, { useEffect, useRef } from "react";
import { useMathKeypad } from "./MathKeypadContext";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.RefObject<any>;
        style?: React.CSSProperties;
        multiline?: string;
        'smart-mode'?: string;
        'smart-fence'?: string;
        'math-virtual-keyboard-policy'?: string;
        placeholder?: string;
      };
    }
  }
}

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
  const { openKeypad } = useMathKeypad();
  const [mounted, setMounted] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Force mathlive import on mount to ensure custom element is registered
    import("mathlive").then((m) => {
      setIsReady(true);
      if (mfRef.current) {
        // Ensure keyboard policies are set
        mfRef.current.mathVirtualKeyboardPolicy = isTeacher ? "auto" : "manual";
        // @ts-ignore
        mfRef.current.virtualKeyboardMode = isTeacher ? "onfocus" : "manual";
        
        // Add shortcuts for arithmetic symbols
        mfRef.current.inlineShortcuts = {
          ...mfRef.current.inlineShortcuts,
          '*': { mode: 'math', value: '\\times' },
          '/': { mode: 'math', value: '\\div' },
          ' ': { mode: 'math', value: '\\ ' }
        };
        
        // If there's an initial value, ensure it's set correctly now that the element is upgraded
        if (value) {
          mfRef.current.value = value;
        }
      }
    });
  }, [isTeacher, value]);

  useEffect(() => {
    if (mfRef.current && template && !value) {
      mfRef.current.value = template;
      onChange(template);
    }
  }, [template, value, onChange]);

  // Sync value changes after initialization
  useEffect(() => {
    if (isReady && mfRef.current && mfRef.current.value !== value) {
      mfRef.current.value = value || "";
    }
  }, [value, isReady]);

  // Handle click outside to blur (for both teachers and students)
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
      onChange((e.target as any).value);
    };

    const handleFocus = () => {
      if (!isTeacher) {
        // Only open keypad if the element has successfully connected to MathLive
        if (typeof el.executeCommand === 'function') {
          openKeypad(el, level);
        } else {
          // Retry slightly later if not ready
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
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("focus", handleFocus);
    return () => {
      el.removeEventListener("input", handleInput);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("focus", handleFocus);
    };
  }, [onChange, onEnter, openKeypad, level, isTeacher]);

  if (!mounted) {
    return (
      <div className={`relative w-full ${className}`}>
        <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 h-[68px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      <div className={`bg-white rounded-2xl border-2 border-indigo-100 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all overflow-hidden p-1 ${containerClassName}`}>
        {/* @ts-ignore */}
        <math-field
          ref={mfRef}
          style={{ 
            width: "100%", 
            fontSize: "1.25rem",
            padding: "0.75rem",
            border: "none",
            outline: "none",
            background: "transparent",
            minHeight: "3.5rem",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word"
          }}
          multiline="true"
          smart-mode="true"
          smart-fence="true"
          math-virtual-keyboard-policy={isTeacher ? "auto" : "manual"}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
