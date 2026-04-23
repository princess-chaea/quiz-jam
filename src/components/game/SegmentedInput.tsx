"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SegmentedInputProps {
  value: string;
  length: number;
  hint?: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  firstRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

export function SegmentedInput({
  value,
  length,
  hint,
  onChange,
  onEnter,
  autoFocus,
  firstRef,
  className
}: SegmentedInputProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  // Use local state to prevent IME breaking due to re-renders/value prop updates
  const [localValue, setLocalValue] = useState(value);
  const [isComposing, setIsComposing] = useState(false);

  // Sync local value with prop if prop changes externally (e.g., reset)
  useEffect(() => {
    if (value !== localValue && !isComposing) {
      setLocalValue(value);
    }
  }, [value, isComposing]);

  useEffect(() => {
    if (autoFocus && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // During composition, we allow the value to exceed length to prevent syllable breaking
    if (isComposing) {
      setLocalValue(val);
      return;
    }
    
    const finalVal = val.slice(0, length);
    setLocalValue(finalVal);
    onChange(finalVal);
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // After composition, truncate to final length
    const val = (e.currentTarget as HTMLInputElement).value.slice(0, length);
    setLocalValue(val);
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Ensure current local value is synced before Enter
      onChange(localValue.slice(0, length));
      // Added a small delay to ensure IME composition is finished before submission
      setTimeout(() => {
        onEnter?.();
      }, 30);
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
          if (hiddenInputRef) (hiddenInputRef as any).current = el;
          if (firstRef) (firstRef as any).current = el;
        }}
        type="text"
        value={localValue}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 opacity-0 z-10 cursor-text"
        autoFocus={autoFocus}
        autoComplete="off"
        // Avoid maxLength here as it blocks IME completion on the last box
      />
      
      {/* Visual segments */}
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-10 h-12 md:w-12 md:h-14 bg-white border-2 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-indigo-600 outline-none transition-all relative overflow-hidden",
            // Highlight current input position
            (localValue.length === i || (i === length - 1 && localValue.length >= length)) 
              ? "border-indigo-500 ring-4 ring-indigo-50/50 scale-105" 
              : "border-slate-200",
            localValue[i] ? "border-indigo-400 bg-indigo-50/20" : "border-slate-100 bg-white"
          )}
        >
          {localValue[i] ? localValue[i] : (hint ? (
             <span className="text-slate-200 pointer-events-none">{hint[i] || ""}</span>
          ) : "")}
          {/* Caret effect */}
          {localValue.length === i && (
            <div className="absolute w-0.5 h-6 bg-indigo-500 animate-pulse rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}

