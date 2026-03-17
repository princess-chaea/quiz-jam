"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  placeholder?: string;
  template?: string;
  level?: 'elementary' | 'middle' | 'high';
}

const KEYPAD_PRESETS = {
  numbers: [
    { label: "1", latex: "1" }, { label: "2", latex: "2" }, { label: "3", latex: "3" },
    { label: "4", latex: "4" }, { label: "5", latex: "5" }, { label: "6", latex: "6" },
    { label: "7", latex: "7" }, { label: "8", latex: "8" }, { label: "9", latex: "9" },
    { label: "0", latex: "0" }, { label: ".", latex: "." }, { label: "-", latex: "-" },
  ],
  basic: [
    { label: "+", latex: "+" }, { label: "−", latex: "-" }, { label: "×", latex: "\\times" }, { label: "÷", latex: "\\div" },
    { label: "분수", latex: "\\frac{\\square}{\\square}" }, { label: "루트", latex: "\\sqrt{\\square}" },
    { label: "( )", latex: "(" }, { label: "=", latex: "=" },
    { label: "x", latex: "x" }, { label: "y", latex: "y" }, { label: "n", latex: "n" }, { label: "π", latex: "\\pi" },
  ],
  advanced: [
    { label: "x²", latex: "x^{2}" }, { label: "xⁿ", latex: "x^{\\square}" }, 
    { label: "√", latex: "\\sqrt{\\square}" }, { label: "∛", latex: "\\sqrt[3]{\\square}" },
    { label: "sin", latex: "\\sin" }, { label: "cos", latex: "\\cos" }, { label: "tan", latex: "\\tan" },
    { label: "log", latex: "\\log" }, { label: "ln", latex: "\\ln" }, { label: "∞", latex: "\\infty" },
    { label: "θ", latex: "\\theta" }, { label: "∑", latex: "\\sum" },
  ]
};

export function MathInput({ value, onChange, onEnter, className = "", placeholder, template, level = 'elementary' }: MathInputProps) {
  const mfRef = useRef<any>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadPos, setKeypadPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'num' | 'sym'>('num');

  useEffect(() => {
    if (mfRef.current && template && !value) {
      mfRef.current.value = template;
      onChange(template);
    }
  }, [template]);

  useEffect(() => {
    import("mathlive").then(() => {
      if (mfRef.current) {
        // Disable default virtual keyboard
        mfRef.current.virtualKeyboardMode = "manual";
      }
    });
  }, []);

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

    const handleFocus = () => setShowKeypad(true);

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
  }, [onChange, onEnter]);

  const insertLatex = (latex: string) => {
    if (!mfRef.current) return;
    
    if (latex === "(" || latex === ")" || latex === "[" || latex === "{") {
        mfRef.current.executeCommand(['typedText', latex, { 
            focus: true, 
            feedback: true, 
            simulateKeystroke: true 
        }]);
    } else {
        mfRef.current.executeCommand(['insert', latex, { focus: true }]);
    }
    
    setTimeout(() => mfRef.current?.focus(), 0);
  };

  const command = (name: string) => {
    mfRef.current?.executeCommand([name]);
    setTimeout(() => mfRef.current?.focus(), 0);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX - keypadPos.x, y: clientY - keypadPos.y };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setKeypadPos({
        x: clientX - dragStart.current.x,
        y: clientY - dragStart.current.y
      });
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

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
          math-virtual-keyboard-policy="manual"
          placeholder={placeholder}
        />
      </div>

      {showKeypad && (
        <div 
          style={{ 
            transform: `translate(${keypadPos.x}px, ${keypadPos.y}px)`,
            zIndex: 1000
          }}
          className="fixed bottom-24 left-1/2 -ml-[160px] w-[320px] bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-pop"
        >
          <div 
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="h-10 bg-indigo-50/50 flex items-center justify-between px-4 cursor-move border-b border-white/20"
          >
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" />
            </div>
            <GripVertical className="text-indigo-300" size={16} />
            <button 
                onClick={() => setShowKeypad(false)}
                className="hover:bg-red-100 p-1.5 rounded-full transition-colors"
            >
                <X size={16} className="text-slate-400" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex gap-2 bg-slate-100/50 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('num')}
                className={cn(
                    "flex-1 py-1.5 px-3 rounded-lg text-sm font-black transition-all",
                    activeTab === 'num' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                123
              </button>
              <button 
                onClick={() => setActiveTab('sym')}
                className={cn(
                    "flex-1 py-1.5 px-3 rounded-lg text-sm font-black transition-all",
                    activeTab === 'sym' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                기호
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {activeTab === 'num' ? (
                <>
                  {KEYPAD_PRESETS.numbers.map(key => (
                    <KeyButton key={key.label} onClick={() => insertLatex(key.latex)} label={key.label} />
                  ))}
                  <KeyButton onClick={() => command('deleteBackward')} label="⌫" className="bg-red-50 text-red-500 border-red-100" />
                </>
              ) : (
                <>
                  {(level === 'elementary' ? KEYPAD_PRESETS.basic : KEYPAD_PRESETS.advanced).map(key => (
                    <KeyButton key={key.label} onClick={() => insertLatex(key.latex)} label={key.label} isLatex />
                  ))}
                  <KeyButton onClick={() => command('deleteBackward')} label="⌫" className="bg-red-50 text-red-500 border-red-100 col-span-1" />
                </>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button 
                onClick={() => command('moveToPreviousChar')}
                className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors shadow-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => command('moveToNextChar')}
                className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors shadow-sm"
              >
                <ChevronRight size={20} />
              </button>
              <button 
                onClick={onEnter}
                className="flex-[2] h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-colors shadow-[0_4px_10px_rgba(79,70,229,0.3)] shadow-indigo-200"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyButton({ label, onClick, className = "", isLatex = false }: { label: string, onClick: () => void, className?: string, isLatex?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-12 bg-white hover:bg-indigo-50/50 rounded-xl border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center font-black text-slate-700 shadow-sm overflow-hidden",
        className
      )}
    >
      {isLatex ? (
        <span className="text-xs font-bold">{label}</span>
      ) : label}
    </button>
  );
}
