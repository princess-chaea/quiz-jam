"use client";

import React, { useRef, useState, useEffect } from "react";
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
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [localValue, setLocalValue] = useState(value);
  const [isComposing, setIsComposing] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value !== localValue && !isComposing) {
      setLocalValue(value);
      setCursorPos(value.length);
    }
  }, [value, isComposing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isComposing) {
      setLocalValue(val);
      return;
    }
    const finalVal = val.slice(0, length);
    setLocalValue(finalVal);
    onChange(finalVal);
    setCursorPos(finalVal.length);
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const val = (e.currentTarget as HTMLInputElement).value.slice(0, length);
    setLocalValue(val);
    onChange(val);
    setCursorPos(val.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(localValue.slice(0, length));
      setTimeout(() => { onEnter?.(); }, 30);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Backspace") {
      // Let browser update selectionStart, then sync
      setTimeout(() => {
        const pos = hiddenInputRef.current?.selectionStart ?? localValue.length;
        setCursorPos(pos);
      }, 0);
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    if (!isComposing) {
      const pos = (e.currentTarget as HTMLInputElement).selectionStart ?? localValue.length;
      setCursorPos(pos);
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const handleContainerClick = () => {
    hiddenInputRef.current?.focus();
  };

  // When user clicks a box:
  //   filled box → cursor goes AFTER it (so backspace deletes that character)
  //   empty box  → cursor goes AT it   (so next keystroke fills that box)
  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const approxBoxIndex = Math.min(
      Math.floor((x / rect.width) * length),
      length - 1
    );
    const char = localValue[approxBoxIndex];
    const newPos = char
      ? Math.min(approxBoxIndex + 1, localValue.length)
      : Math.min(approxBoxIndex, localValue.length);
    hiddenInputRef.current?.setSelectionRange(newPos, newPos);
    setCursorPos(newPos);
  };

  // Cursor box: during composition stay on composing char, otherwise use cursorPos
  const cursorBoxIndex = isComposing
    ? Math.max(0, localValue.length - 1)
    : cursorPos;

  return (
    <div
      className={cn("relative flex items-center justify-center cursor-text", className)}
      onClick={handleContainerClick}
    >
      {/*
        'relative z-50': input is topmost element so user taps trigger native keyboard.
        'caret-transparent': hide real input caret; we draw our own per-box cursor.
      */}
      <input
        ref={(el) => {
          (hiddenInputRef as any).current = el;
          if (firstRef) (firstRef as any).current = el;
        }}
        type="text"
        value={localValue}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleInputClick}
        className="w-full h-full p-5 border-4 border-transparent rounded-2xl focus:outline-none text-center font-black relative z-50 bg-transparent text-transparent caret-transparent cursor-text"
        style={{ fontSize: '16px', minHeight: '48px' }}
        autoComplete="off"
        inputMode="text"
        enterKeyHint="done"
      />

      {/* Visual segments - pointer-events-none so input above receives all touches */}
      <div className="absolute inset-0 flex gap-1.5 items-center justify-center pointer-events-none z-10">
        {Array.from({ length }).map((_, i) => {
          const char = localValue[i];
          // isActive: highlight the BACKSPACE TARGET (filled box before cursor)
          // or the typing position (empty box at cursor)
          const isBackspaceTarget = isFocused && !isComposing && cursorPos > 0 && i === cursorPos - 1 && !!char;
          const isTypingPosition  = isFocused && !isComposing && i === cursorPos && !char && i < length;
          const isActive = isBackspaceTarget || isTypingPosition || (isFocused && isComposing && i === Math.max(0, localValue.length - 1));

          const showCursor = isFocused && !isComposing && !char && i === cursorPos && i < length;
          const showComposingCursor = isFocused && isComposing && i === Math.max(0, localValue.length - 1);

          return (
            <div
              key={i}
              ref={el => { boxRefs.current[i] = el; }}
              className={cn(
                "w-10 h-12 md:w-12 md:h-14 bg-white border-2 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-slate-900 outline-none transition-all relative overflow-hidden select-none",
                isActive
                  ? "border-indigo-500 ring-4 ring-indigo-50/50 scale-105"
                  : char
                    ? "border-indigo-300 bg-indigo-50/20"
                    : "border-slate-200 bg-white"
              )}
            >
              {char ? char : (hint ? (
                <span className="text-slate-200">{hint[i] || ""}</span>
              ) : null)}

              {/* Cursor: left-aligned blinking bar in EMPTY box */}
              {showCursor && (
                <div className="absolute left-[6px] top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 animate-pulse rounded-full" />
              )}

              {/* During Korean composition: cursor to RIGHT of the composing char */}
              {showComposingCursor && (
                <div className="absolute right-[6px] top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-400 animate-pulse rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
