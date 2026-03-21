"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn } from "@/lib/utils";
import { Keyboard } from "lucide-react";

/**
 * Converts plain text or mixed LaTeX into a format that MathLive renders correctly,
 * specifically preserving spaces and Korean characters.
 */
const toMathLiveValue = (text: string) => {
  if (!text) return "";
  
  // 1. Normalize and clean up existing backslash-space debris
  // Turn any sequence of backslashes followed by a space into a single regular space
  let result = text.replace(/\\+ /g, ' ');
  
  // Normalize multiplication dots to times symbols
  result = result.replace(/\\cdot/g, '\\times');
  
  // Normalize remaining double backslashes for commands
  result = result.replace(/\\\\/g, '\\');
  
  // 2. Convert spaces to ~ (non-breaking space) for MathLive.
  // This is the most stable way to ensure spaces are visible in math mode.
  result = result.replace(/ /g, '~');
  
  return result;
};

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
  placeholder?: string;
  template?: string;
  focusOnMount?: boolean;
  level?: 'elementary' | 'middle' | 'high';
  isTeacher?: boolean;
  containerClassName?: string;
  multiline?: boolean;
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
  containerClassName = "",
  focusOnMount = false,
  multiline = false
}: MathInputProps) {
  const mfRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const { activeField, openKeypad } = useMathKeypad();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Force mathlive import on mount
    import("mathlive").then((mathlive) => {
      setIsReady(true);
      if (mfRef.current) {
        // Use manual keyboard policy to allow hardware keyboard focus and avoid auto-popups
        mfRef.current.mathVirtualKeyboardPolicy = "manual";
        
        // Disable smart fraction conversion and other auto-conversions if desired
        mfRef.current.setOptions({
          smartFraction: false,
          smartMode: true,
          smartSubsup: true,
          defaultMode: 'text', // START IN TEXT MODE for natural typing
          virtualKeyboardToggle: 'hidden',
          virtualKeyboardMode: 'manual',
          menuIcon: 'none'
        });
        // Explicitly set the toggle policy
        mfRef.current.mathVirtualKeyboardPolicy = "manual";

        // Inject styles into shadow root to force multiline wrapping
        if (mfRef.current.shadowRoot) {
          const style = document.createElement('style');
          style.textContent = `
            .ML__virtual-keyboard-toggle, .ML__menu-toggle, [part="virtual-keyboard-toggle"], [part="menu-toggle"] {
              display: none !important;
              visibility: hidden !important;
            }
            .ML__base {
              display: flex !important;
              flex-wrap: ${multiline ? 'wrap' : 'nowrap'} !important;
              width: 100% !important;
              ${!multiline ? 'overflow-x: auto !important;' : ''}
              line-height: 1.6 !important;
              padding: 4px 0 !important;
            }
            .ML__content {
              display: ${multiline ? 'block' : 'inline-block'} !important;
              ${multiline ? 'width: 100% !important;' : 'min-width: 100% !important;'}
            }
          `;
          mfRef.current.shadowRoot.appendChild(style);
        }
        
        // Add shortcuts for arithmetic symbols and SPACES
        mfRef.current.inlineShortcuts = {
          ...mfRef.current.inlineShortcuts,
          '*': { mode: 'math', value: '\\times' },
          '/': { mode: 'math', value: '\\div' },
          ' ': { mode: 'math', value: '~' }
        };
      }
    });
  }, []);

  // EFFECT REMOVED: No more auto-focusing on isReady to prevent multiple cursors

  useEffect(() => {
    if (mfRef.current && template && !value) {
      const prepared = toMathLiveValue(template);
      mfRef.current.value = prepared;
      lastValueRef.current = template;
      onChangeRef.current(template);
    }
  }, [template, value]);

  // Handling focus on mount
  useEffect(() => {
    if (focusOnMount && isReady && mfRef.current) {
      setTimeout(() => {
        mfRef.current?.focus();
        // Also ensure it's at the end
        const val = mfRef.current.value;
        mfRef.current.value = "";
        mfRef.current.value = val;
      }, 100);
    }
  }, [focusOnMount, isReady]);

  // Sync value changes after initialization
  useEffect(() => {
    if (!isReady || !mfRef.current) return;
    
    // Only update mfRef.current.value if it's the first time or meaningfully different
    // to prevent cursor jumping or blocking input
    if (lastValueRef.current === undefined || value !== lastValueRef.current) {
      const prepared = toMathLiveValue(value);
      if (mfRef.current.value !== prepared) {
        mfRef.current.value = prepared || "";
      }
      lastValueRef.current = value;
    }
  }, [value, isReady]);

  // Handle click outside to blur and hide native keyboard
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!mfRef.current || !containerRef.current) return;
      const path = (e.composedPath?.() || []) as HTMLElement[];
      const isInsideMf = path.includes(mfRef.current);
      const isInsideContainer = path.includes(containerRef.current);
      const isInsideKeypad = path.some(el => el.classList?.contains('math-keypad-container'));
      const isKeyboardClick = path.some(el => el.classList?.contains('ML__keyboard') || el.closest?.('.ML__virtual-keyboard'));
      
      if (!isInsideMf && !isInsideContainer && !isInsideKeypad && !isKeyboardClick) {
        mfRef.current?.blur?.();
        // Force hide the global native keyboard
        // @ts-ignore
        if (window.mathVirtualKeyboard && window.mathVirtualKeyboard.visible) {
           // @ts-ignore
           window.mathVirtualKeyboard.hide();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    
    // Cleanup: Hide keyboard when this input unmounts
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      // @ts-ignore
      if (window.mathVirtualKeyboard && window.mathVirtualKeyboard.visible) {
          // @ts-ignore
          window.mathVirtualKeyboard.hide();
      }
    };
  }, []);

  // Use refs to prevent listener re-binding on prop updates
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  // Focus Synchronization: Blur if another field becomes active in the context
  useEffect(() => {
    if (activeField && activeField !== mfRef.current) {
      if (mfRef.current && document.activeElement === mfRef.current) {
        mfRef.current.blur();
      }
    }
  }, [activeField]);

  // Use a state-tracked element to ensure listeners are attached when the DOM is ready
  const [mfElement, setMfElement] = useState<any>(null);

  useEffect(() => {
    const el = mfElement || mfRef.current;
    if (!el || !isReady) return;

    const handleUpdate = (e: Event) => {
      const liveValue = el.getValue?.() || el.value || "";
      
      // CRITICAL: Convert LaTeX space markers (~ and \ ) back to regular spaces.
      // We also clean up any accidental double backslashes that might have leaked.
      const normalizedValue = liveValue
        .replace(/~/g, ' ')
        .replace(/\\displaylines/g, '')
        .replace(/\\ /g, ' ');
      
      if (lastValueRef.current === normalizedValue) return;
      
      lastValueRef.current = normalizedValue; 
      onChangeRef.current(normalizedValue);
    };

    const handleFocus = () => {
      if (typeof el.executeCommand === 'function') {
        openKeypad(el, level);
      } else {
        setTimeout(() => {
          if (typeof el.executeCommand === 'function') {
            openKeypad(el, level);
          }
        }, 100);
      }
    };

    const handleKeyDown = (e: any) => {
      if (e.key === 'Enter') {
        if (onEnterRef.current) {
          e.preventDefault();
          onEnterRef.current();
        }
      }
      
      // Explicitly handle space to insert a LaTeX non-breaking space (~)
      if (e.key === ' ' && !e.shiftKey) {
        if (typeof el.executeCommand === 'function') {
          e.preventDefault();
          el.executeCommand(["insert", "~"]);
          handleUpdate(e);
        }
        return;
      }

      if (e.key === "/") {
        if (typeof el.executeCommand === 'function') {
          e.preventDefault();
          el.executeCommand(["insert", "\\div "]);
          handleUpdate(e);
        }
        return;
      }

      if (e.key === "*") {
        if (typeof el.executeCommand === 'function') {
          e.preventDefault();
          el.executeCommand(["insert", "\\times "]);
          handleUpdate(e);
        }
        return;
      }
    };

    // Use 'input' for real-time updates and 'change' for finality
    el.addEventListener("input", handleUpdate);
    el.addEventListener("change", handleUpdate);
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("focus", handleFocus);
    el.addEventListener("blur", handleUpdate);
    
    // Initial sync
    handleUpdate(new Event('init'));
    
    return () => {
      el.removeEventListener("input", handleUpdate);
      el.removeEventListener("change", handleUpdate);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("blur", handleUpdate);
    };
  }, [mfElement, isReady, openKeypad, level]);

  const handleToggleKeyboard = () => {
    // @ts-ignore
    if (window.mathVirtualKeyboard) {
      // @ts-ignore
      if (window.mathVirtualKeyboard.visible) {
        // @ts-ignore
        window.mathVirtualKeyboard.hide();
      } else {
        // @ts-ignore
        window.mathVirtualKeyboard.show();
      }
    }
  };

  if (!isReady || !mounted) {
    return (
      <div className={cn("relative w-full rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center min-h-[100px]", containerClassName)}>
         <div className="flex flex-col items-center gap-2">
           <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
           <p className="text-[10px] font-bold text-slate-400 italic">수식 편집기 로드 중...</p>
         </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full rounded-2xl overflow-hidden group/math bg-slate-50/50 border-2 border-slate-100 focus-within:border-indigo-400 focus-within:bg-white transition-all cursor-text", containerClassName)}
      onClick={() => {
        // Use a slight delay to ensure browser focus transitions don't conflict
        setTimeout(() => {
          if (mfRef.current && document.activeElement !== mfRef.current) {
            mfRef.current.focus();
          }
        }, 10);
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        math-field {
          display: block !important;
          width: 100% !important;
          min-height: 2.5rem;
          height: auto !important;
          overflow: visible !important;
          background: transparent !important;
        }
        math-field::part(container) {
          width: 100% !important;
          display: block !important;
          padding: 1rem !important; /* Move padding here */
          overflow-x: auto !important;
          overflow-y: hidden !important;
        }
        math-field::part(content) {
          white-space: ${multiline ? 'pre-wrap' : 'nowrap'} !important;
          overflow-wrap: ${multiline ? 'break-word' : 'normal'} !important;
          word-break: ${multiline ? 'break-all' : 'normal'} !important;
          text-align: left !important;
          display: ${multiline ? 'block' : 'inline-block'} !important;
          width: ${multiline ? '100%' : 'auto'} !important;
          min-width: 100% !important;
          padding: 0 !important;
        }
        /* Hide MathLive internal virtual keyboard toggle and menu toggles */
        math-field::part(virtual-keyboard-toggle),
        math-field::part(menu-toggle) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          pointer-events: none !important;
        }
      `}} />
      <math-field
        ref={(el: any) => {
          mfRef.current = el;
          if (el !== mfElement) setMfElement(el);
        }}
        className={cn("w-full outline-none", className)}
        style={{ 
          width: "100%", 
          minHeight: "80px",
          background: "transparent",
          border: "none",
          fontSize: "1.125rem",
          display: 'block'
        }}
        multiline={multiline ? "true" : "false"}
        math-virtual-keyboard-policy="manual"
        virtual-keyboard-toggle="hidden"
        menu-icon="none"
        placeholder={placeholder}
      >
        {toMathLiveValue(value)}
      </math-field>
      
    </div>
  );
}
