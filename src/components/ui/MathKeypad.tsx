"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, GripVertical, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMathKeypad } from "./MathKeypadContext";
import { usePathname } from "next/navigation";

const KEYPAD_PRESETS = {
  num: [
    { label: "1", latex: "1" }, { label: "2", latex: "2" }, { label: "3", latex: "3" },
    { label: "+", latex: "+" },
    { label: "4", latex: "4" }, { label: "5", latex: "5" }, { label: "6", latex: "6" },
    { label: "-", latex: "-" },
    { label: "7", latex: "7" }, { label: "8", latex: "8" }, { label: "9", latex: "9" },
    { label: "×", latex: "\\times" },
    { label: ".", latex: "." }, { label: "0", latex: "0" }, { label: "=", latex: "=" },
    { label: "÷", latex: "\\div" },
  ],
  elem: [
    { label: "□/□", latex: "\\frac{#?}{#?}" }, { label: "0.1", latex: "0.1" }, 
    { label: "3.14", latex: "3.14" }, { label: ">", latex: ">" },
    { label: "<", latex: "<" }, { label: "cm²", latex: "\\text{cm}^2" }, 
    { label: "m²", latex: "\\text{m}^2" }, { label: "km²", latex: "\\text{km}^2" },
    { label: "( )", latex: "(#?)" }, { label: "{}", latex: "{#?}" },
    { label: "[:]", latex: "#? : #?" }, { label: "kg", latex: "\\text{kg}" },
    { label: "g", latex: "\\text{g}" }, { label: "mL", latex: "\\text{mL}" },
    { label: "L", latex: "\\text{L}" }, { label: "원", latex: "\\text{원}" },
  ],
  mid: [
    { label: "xⁿ", latex: "#?^{#?}" }, { label: "√□", latex: "\\sqrt{#?}" },
    { label: "|□|", latex: "|#?|" }, { label: "π", latex: "\\pi" },
    { label: "x", latex: "x" }, { label: "y", latex: "y" }, { label: "z", latex: "z" },
    { label: "△", latex: "\\triangle" }, { label: "∠", latex: "\\angle" },
    { label: "⊥", latex: "\\perp" }, { label: "∥", latex: "\\parallel" },
    { label: "≡", latex: "\\equiv" }, { label: "∽", latex: "\\sim" },
    { label: "±", latex: "\\pm" }, { label: "≤", latex: "\\le" },
    { label: "≥", latex: "\\ge" }, { label: "∞", latex: "\\infty" },
    { label: "y=ax+b", latex: "y=ax+b" }, { label: "x²", latex: "x^2" },
  ],
  high: [
    { label: "∪", latex: "\\cup" }, { label: "∩", latex: "\\cap" }, 
    { label: "∈", latex: "\\in" }, { label: "⊂", latex: "\\subset" },
    { label: "→", latex: "\\rightarrow" }, { label: "∴", latex: "\\therefore" },
    { label: "∵", latex: "\\because" }, { label: "f(x)", latex: "f(x)" },
    { label: "lim", latex: "\\lim_{#? \\to #?}" }, { label: "f'(x)", latex: "f'(x)" },
    { label: "dy/dx", latex: "\\frac{dy}{dx}" }, { label: "∫", latex: "\\int_{#?}^{#?}" },
    { label: "nPr", latex: "_{#?}P_{#?}" }, { label: "nCr", latex: "_{#?}C_{#?}" },
    { label: "n!", latex: "#? !" }, { label: "Σ", latex: "\\sum_{#?=#?}^{#?}" },
    { label: "log", latex: "\\log_{#?}{#?}" }, { label: "ln", latex: "\\ln{#?}" },
    { label: "→a", latex: "\\vec{#?}" },
    { label: "∂", latex: "\\partial" }, { label: "∇", latex: "\\nabla" },
  ]
};

export function MathKeypad() {
  const { activeField, isOpen, pos, level, closeKeypad, updatePos } = useMathKeypad();
  const pathname = usePathname();
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'num' | 'elem' | 'mid' | 'high'>('num');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set initial tab based on level
    if (level === 'elementary') setActiveTab('elem');
    else if (level === 'middle') setActiveTab('mid');
    else if (level === 'high') setActiveTab('high');
  }, [level]);

  // Close keypad on route change
  useEffect(() => {
    closeKeypad();
  }, [pathname, closeKeypad]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      updatePos({
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
  }, [isDragging, updatePos]); // Removed 'pos' from deps as it's not used inside anymore (using dragStart.current)

  // Consolidated click-outside listener for robustness (including Shadow DOM)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const path = e.composedPath() as HTMLElement[];
      
      // Check if the click is inside the keypad
      const isKeypadClick = path.some(el => 
        el.classList?.contains('math-keypad-container')
      );
      
      // Check if the click is on a math-field (the input area)
      const isMathFieldClick = path.some(el => 
        el.tagName?.toLowerCase() === 'math-field'
      );

      // If click is outside both the keypad and the math-field, close it
      if (!isKeypadClick && !isMathFieldClick) {
        closeKeypad();
      }
    };

    // Use capture: true to catch clicks before they might be stopped by e.stopPropagation()
    window.addEventListener('mousedown', handleClickOutside, true);
    return () => window.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, closeKeypad]);

  if (!mounted) return null;

  const insertLatex = (latex: string) => {
    if (!activeField || typeof activeField.executeCommand !== 'function') return;
    
    // Use focus: true and feedback: true for better placeholder handling
    activeField.executeCommand(['insert', latex, { focus: true, feedback: true }]);
    
    setTimeout(() => activeField?.focus?.(), 0);
  };

  const command = (name: string) => {
    if (!activeField || typeof activeField.executeCommand !== 'function') return;
    activeField.executeCommand([name]);
    setTimeout(() => activeField?.focus?.(), 0);
  };

  const moveToNext = () => {
    if (!activeField || typeof activeField.executeCommand !== 'function') return;
    activeField.executeCommand('moveToNextPlaceholder');
    setTimeout(() => activeField?.focus?.(), 0);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const keypadUI = (
    <div 
      style={{ 
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: 10000,
        display: isOpen ? 'block' : 'none'
      }}
      className={cn(
        "math-keypad-container fixed top-2 left-1/2 -translate-x-1/2 w-[95%] max-w-[380px] bg-white/95 backdrop-blur-xl rounded-[2rem] border border-white/50 shadow-[0_20px_40px_rgba(0,0,0,0.15)] overflow-hidden",
        isOpen ? "animate-in slide-in-from-top-4 duration-300 scale-100" : "hidden pointer-events-none scale-95"
      )}
    >
      <div 
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className="h-10 bg-indigo-50/50 flex items-center justify-between px-5 cursor-move border-b border-indigo-100/50"
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <GripVertical className="text-indigo-200" size={14} />
        <button 
            onClick={closeKeypad}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            className="hover:bg-red-50 p-1 rounded-full transition-colors"
        >
            <X size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex gap-1 bg-slate-100/80 p-1 rounded-2xl overflow-x-auto no-scrollbar">
          {[
            { id: 'num', label: '123' },
            { id: 'elem', label: '초등' },
            { id: 'mid', label: '중등' },
            { id: 'high', label: '고등' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
              className={cn(
                  "flex-1 py-2 px-2 rounded-xl text-xs font-black transition-all whitespace-nowrap",
                  activeTab === tab.id ? "bg-white text-indigo-600 shadow-md scale-105" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5 min-h-[180px]">
          {activeTab === 'num' ? (
            <>
              {KEYPAD_PRESETS.num.map((key, idx) => (
                <KeyButton key={"num" + key.label + idx} onClick={() => insertLatex(key.latex)} label={key.label} />
              ))}
              <KeyButton onClick={() => command('deleteBackward')} label="⌫" className="bg-red-50 text-red-500 border-red-200" />
              <KeyButton onClick={moveToNext} label="Tab" className="bg-emerald-50 text-emerald-600 border-emerald-200" />
            </>
          ) : (
            <>
              {(KEYPAD_PRESETS[activeTab as keyof typeof KEYPAD_PRESETS] || []).map((key, idx) => (
                <KeyButton key={activeTab + key.label + idx} onClick={() => insertLatex(key.latex)} label={key.label} isLatex />
              ))}
              <KeyButton onClick={() => command('deleteBackward')} label="⌫" className="bg-red-50 text-red-500 border-red-200" />
              <KeyButton onClick={moveToNext} label="Tab" className="bg-emerald-50 text-emerald-600 border-emerald-200" />
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <button 
            onClick={() => command('moveToPreviousChar')}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => command('moveToNextChar')}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
          <button 
            onClick={() => command('showVirtualKeyboard')}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            className="flex-1 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors shadow-sm"
            title="고급 수식 키보드 열기"
          >
            <Keyboard size={20} />
          </button>
          <button 
            onClick={closeKeypad}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            className="flex-[2] h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-colors shadow-[0_4px_10px_rgba(79,70,229,0.3)] shadow-indigo-200"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(keypadUI, document.body);
}

function KeyButton({ label, onClick, className = "", isLatex = false }: { label: string, onClick: () => void, className?: string, isLatex?: boolean }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "h-10 bg-white hover:bg-indigo-50/50 rounded-xl border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center font-black text-slate-700 shadow-sm overflow-hidden",
        className
      )}
    >
      {isLatex ? (
        <span className="text-xs font-bold">{label}</span>
      ) : label}
    </button>
  );
}
