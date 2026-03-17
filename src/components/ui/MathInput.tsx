"use client";

import React, { useEffect, useRef } from "react";
import { useMathKeypad } from "./MathKeypadContext";

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  placeholder?: string;
  template?: string;
  level?: 'elementary' | 'middle' | 'high';
  isTeacher?: boolean;
}

export function MathInput({ 
  value, 
  onChange, 
  onEnter, 
  className = "", 
  placeholder, 
  template, 
  level = 'elementary',
  isTeacher = false
}: MathInputProps) {
  const mfRef = useRef<any>(null);
  const { openKeypad } = useMathKeypad();

  useEffect(() => {
    if (mfRef.current && template && !value) {
      mfRef.current.value = template;
      onChange(template);
    }
  }, [template, value, onChange]);

  useEffect(() => {
    import("mathlive").then(() => {
      if (mfRef.current) {
        // Teachers use built-in keyboard, students use custom
        mfRef.current.virtualKeyboardMode = isTeacher ? "onfocus" : "manual";
      }
    });
  }, [isTeacher]);

  // Handle click outside to blur for teachers
  useEffect(() => {
    if (!isTeacher) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (mfRef.current && !mfRef.current.contains(e.target as Node)) {
        // Also check if the click is on the mathlive virtual keyboard
        const isKeyboardClick = (e.target as HTMLElement).closest('.ML__keyboard');
        if (!isKeyboardClick) {
          mfRef.current.blur();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTeacher]);

  useEffect(() => {
    if (mfRef.current && mfRef.current.value !== value) {
      mfRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    const el = mfRef.current;
    if (!el) return;

    const handleInput = (e: Event) => {
      onChange((e.target as any).value);
    };

    const handleFocus = () => {
      if (!isTeacher) {
        openKeypad(el, level);
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

  return (
    <div className={`relative w-full ${className}`}>
      <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all overflow-hidden p-1">
        {/* @ts-ignore */}
        <math-field
          ref={mfRef}
          style={{ 
            width: "100%", 
            fontSize: "1.25rem",
            padding: "0.75rem",
            border: "none",
            outline: "none",
            background: "transparent"
          }}
          smart-mode="true"
          math-virtual-keyboard-policy={isTeacher ? "auto" : "manual"}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
