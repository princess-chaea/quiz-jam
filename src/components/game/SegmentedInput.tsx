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
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, length);
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onEnter?.();
    }
  };

  const handleContainerClick = () => {
    hiddenInputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex gap-1.5 items-center cursor-text", className)} onClick={handleContainerClick}>
      {/* Hidden input to handle all input and IME composition natively */}
      <input
        ref={(el) => {
          (hiddenInputRef as any).current = el;
          if (firstRef) (firstRef as any).current = el;
        }}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 opacity-0 cursor-default pointer-events-none"
        autoFocus={autoFocus}
        maxLength={length}
      />
      
      {/* Visual segments */}
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-10 h-12 md:w-12 md:h-14 bg-white border-2 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-indigo-600 outline-none transition-all",
            // Highlight the active character segment or the current input position
            (value.length === i || (i === length - 1 && value.length === length)) ? "border-indigo-500 ring-4 ring-indigo-50/50 scale-105" : "border-slate-200",
            value[i] ? "border-indigo-400 bg-indigo-50/20" : "border-slate-100 bg-white"
          )}
        >
          {value[i] || ""}
          {/* Caret effect for the current position */}
          {value.length === i && (
            <div className="absolute w-0.5 h-6 bg-indigo-500 animate-pulse rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}
