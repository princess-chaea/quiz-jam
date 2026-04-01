"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SegmentedInputProps {
  value: string;
  length: number;
  onChange: (val: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  firstRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

export function SegmentedInput({
  value,
  length,
  onChange,
  onEnter,
  autoFocus,
  firstRef,
  className
}: SegmentedInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    inputsRef.current = inputsRef.current.slice(0, length);
  }, [length]);

  const handleChange = (index: number, char: string) => {
    // Only allow single character
    const newChar = char.slice(-1);
    const newValue = value.split("");
    
    // Fill or replace
    while (newValue.length < length) newValue.push("");
    newValue[index] = newChar;
    
    const finalValue = newValue.slice(0, length).join("");
    onChange(finalValue);

    // Auto-focus next input if char is entered
    if (newChar && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        // Focus previous and clear it
        inputsRef.current[index - 1]?.focus();
        const newValue = value.split("");
        newValue[index - 1] = "";
        onChange(newValue.join(""));
      }
    } else if (e.key === "Enter") {
      onEnter?.();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  return (
    <div className={cn("flex gap-1.5 items-center", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
            if (i === 0 && firstRef) {
              (firstRef as any).current = el;
            }
          }}
          type="text"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoFocus={autoFocus && i === 0}
          className={cn(
            "w-10 h-12 md:w-12 md:h-14 bg-white border-2 border-slate-200 rounded-xl text-center text-xl md:text-2xl font-black text-indigo-600 outline-none transition-all",
            "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 focus:scale-105",
            value[i] ? "border-indigo-400 bg-indigo-50/20" : "border-slate-100"
          )}
        />
      ))}
    </div>
  );
}
