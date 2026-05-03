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
  const [localValue, setLocalValue] = useState(value);
  const [isComposing, setIsComposing] = useState(false);

  // Sync local value with prop if prop changes externally (e.g., reset)
  useEffect(() => {
    if (value !== localValue && !isComposing) {
      setLocalValue(value);
    }
  }, [value, isComposing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // During composition (Korean IME), allow value to exceed length temporarily
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
    // After composition ends, truncate to final length
    const val = (e.currentTarget as HTMLInputElement).value.slice(0, length);
    setLocalValue(val);
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(localValue.slice(0, length));
      // Small delay to ensure IME composition is finished before submission
      setTimeout(() => { onEnter?.(); }, 30);
    }
  };

  const handleContainerClick = () => {
    hiddenInputRef.current?.focus();
  };

  /**
   * 커서 박스 인덱스 계산 (한글 IME 조합 고려):
   * 
   * 한글은 초성+중성(+종성)이 합쳐져 한 글자를 이룸.
   * 조합 중일 때는 localValue.length가 이미 1 증가한 상태이므로,
   * 커서를 현재 조합 중인 칸(length - 1)에 표시해야 함.
   * 
   * 예시:
   *   'ㄱ' 입력 중 → isComposing=true, localValue="ㄱ"(length=1) → cursor at box 0
   *   '가' 완성 후 → isComposing=false, localValue="가"(length=1) → cursor at box 1
   *   '가' 입력 후 'ㄴ' 조합 시작 → isComposing=true, localValue="가ㄴ"(length=2) → cursor at box 1
   */
  const cursorBoxIndex = isComposing
    ? Math.max(0, localValue.length - 1)
    : localValue.length;

  return (
    <div
      className={cn("relative flex items-center justify-center cursor-text", className)}
      onClick={handleContainerClick}
    >
      {/*
        CRITICAL FOR MOBILE KEYBOARD:
        'relative z-50' makes the input the topmost hit target so the user
        taps it directly → browser's native keyboard trigger fires.
        
        'caret-transparent' hides the real text cursor from the full-width input
        (whose cursor position doesn't align with the visual boxes). Instead,
        we draw our own cursor indicator at the correct box position below.
      */}
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
        className="w-full h-14 p-5 border-4 border-transparent rounded-2xl focus:outline-none text-center font-black relative z-50 bg-transparent text-transparent caret-transparent cursor-text"
        style={{ fontSize: '16px' }}
        autoComplete="off"
        inputMode="text"
        enterKeyHint="done"
      />

      {/* Visual segments layer placed behind the interactive input */}
      <div className="absolute inset-0 flex gap-1.5 items-center justify-center pointer-events-none z-10">
        {Array.from({ length }).map((_, i) => {
          // The "active" (highlighted) box is where the next character will go,
          // or the last box when all slots are filled.
          const isActive = localValue.length < length
            ? i === cursorBoxIndex
            : i === length - 1;

          return (
            <div
              key={i}
              className={cn(
                "w-10 h-12 md:w-12 md:h-14 bg-white border-2 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-indigo-600 outline-none transition-all relative overflow-hidden",
                isActive
                  ? "border-indigo-500 ring-4 ring-indigo-50/50 scale-105"
                  : "border-slate-200",
                localValue[i] ? "border-indigo-400 bg-indigo-50/20" : "border-slate-100 bg-white"
              )}
            >
              {localValue[i] ? localValue[i] : (hint ? (
                <span className="text-slate-200">{hint[i] || ""}</span>
              ) : "")}
              {/*
                Cursor blinks inside the active box only when:
                - The box is empty (no character yet), OR
                - Korean IME is currently composing in this box
              */}
              {isActive && (!localValue[i] || isComposing) && (
                <div className="absolute w-0.5 h-6 bg-indigo-500 animate-pulse rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
