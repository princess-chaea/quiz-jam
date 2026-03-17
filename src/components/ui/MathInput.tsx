"use client";

import React, { useEffect, useRef } from "react";

// For TypeScript to recognize the custom web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
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
}

export function MathInput({ value, onChange, onEnter, className = "", placeholder }: MathInputProps) {
  const mfRef = useRef<any>(null);

  useEffect(() => {
    // Initialize MathLive only on the client
    import("mathlive").then(() => {
      if (mfRef.current) {
        // Apply MathLive configuration
        window.mathVirtualKeyboard.layouts = ["default"]; 
      }
    });
  }, []);

  useEffect(() => {
    // Keep value in sync when it changes from outside
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
    };

    el.addEventListener("input", handleInput);
    el.addEventListener("keydown", handleKeyDown);
    return () => {
      el.removeEventListener("input", handleInput);
      el.removeEventListener("keydown", handleKeyDown);
    };
  }, [onChange, onEnter]);

  return (
    <div className={`relative w-full ${className}`}>
      <math-field
        ref={mfRef}
        style={{ width: "100%", display: "block" }}
        // @ts-ignore
        smart-mode="true"
        math-virtual-keyboard-policy="auto"
        placeholder={placeholder}
      />
    </div>
  );
}
