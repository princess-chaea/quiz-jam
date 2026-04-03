"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn, hasMathSymbols } from "@/lib/utils";
import { Keyboard, RefreshCw } from "lucide-react";

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
  showScrollbar?: boolean; // New prop to force scrollbar
  forceMathKeypad?: boolean; // New prop to force math keypad for students
  isFirstQuestion?: boolean; // New prop to control keyboard hint visibility
  gameId?: string; // Prop to track if it's a new game instance
  onRefresh?: () => void; // New prop for manual focus/refresh
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
  multiline = false,
  showScrollbar = false,
  forceMathKeypad = false,
  isFirstQuestion = false,
  gameId = "global",
  onRefresh
}: MathInputProps) {
  const mfRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const { activeField, openKeypad } = useMathKeypad();
  const [isReady, setIsReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const forceFocus = (mathFieldEl: any) => {
    if (!mathFieldEl) return;
    if (typeof mathFieldEl.focus === 'function') {
      mathFieldEl.focus();
    }
  };

  const handleManualRefresh = () => {
    if (!mfRef.current) return;
    
    // Safety blur-and-refocus
    mfRef.current.blur();
    
    setTimeout(() => {
      if (mfRef.current) {
        forceFocus(mfRef.current);
        
        // Auto-show keypad if needed
        const shouldShow = isTeacher || forceMathKeypad || hasMathSymbols(mfRef.current.value) || hasMathSymbols(template);
        if (shouldShow) openKeypad(mfRef.current, level);
        
        if (onRefresh) onRefresh();
      }
    }, 50);
  };

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
        
        // Global sound disabling for ALL mathfields to prevent 404s
        const mfElementClass = (mathlive as any).MathfieldElement;
        if (mfElementClass) {
          mfElementClass.keypressSound = 'none';
          mfElementClass.plonkSound = 'none';
          mfElementClass.soundsDirectory = null;
        }

        // Disable smart fraction conversion and other auto-conversions if desired
        mfRef.current.setOptions({
          smartFraction: false,
          smartMode: true,
          smartSubsup: true,
          defaultMode: 'math', // Set to math by default to ensure symbols work immediately
          virtualKeyboardToggle: 'hidden',
          virtualKeyboardMode: 'manual',
          menuIcon: 'none',
          keypressSound: 'none',
          plonkSound: 'none',
          soundsDirectory: "", // Set to empty string to prevent default path lookup
          onKeystroke: (mf: any, keystroke: string, ev: KeyboardEvent) => {
            if (keystroke === '*' || keystroke === '/') {
              return false; // Prevent default MathLive keystroke handling
            }
            return true;
          }
        });
        mfRef.current.soundsDirectory = ""; // Also set on instance directly
        mfRef.current.keypressSound = "none";
        mfRef.current.plonkSound = "none";
        
        // Add shortcuts for arithmetic symbols and SPACES
        mfRef.current.inlineShortcuts = {
          ...mfRef.current.inlineShortcuts,
          '*': '', 
          '/': '',
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
      // SMART KEYPAD LOGIC:
      // Always show for teachers.
      // For students, only show if forceMathKeypad is true OR current value contains math symbols.
      const shouldShow = isTeacher || forceMathKeypad || hasMathSymbols(el.value) || hasMathSymbols(template);
      
      if (shouldShow) {
        if (typeof el.executeCommand === 'function') {
          openKeypad(el, level);
        } else {
          setTimeout(() => {
            if (typeof el.executeCommand === 'function') {
              openKeypad(el, level);
            }
          }, 100);
        }
      }
    };

    const handleCompositionStart = (e: Event) => {
      // CRITICAL: When clicking the gap, MathLive cursor is at top-level math mode.
      // Top-level math mode rejects IME composition (Korean). 
      // We must forcefully switch to text mode to accept it!
      try { el.executeCommand(['switchMode', 'text']); } catch (err) {}
      try { el.executeCommand(['setMode', 'text']); } catch (err) {}
    };

    const handlePointerUp = (e: Event) => {
      // MathLive sometimes updates its internal cursor on gap click, but fails to focus the actual IME textarea.
      forceFocus(el);
      
      const shouldShow = isTeacher || forceMathKeypad || hasMathSymbols(el.value) || hasMathSymbols(template);
      
      setTimeout(() => {
        forceFocus(el);
        if (shouldShow && typeof el.executeCommand === 'function') {
          openKeypad(el, level);
        }
      }, 50);
    };

    const handleKeyDown = (e: any) => {
      // Force text mode if a Korean key is pressed (sometimes IME masks this as Process, but we check just in case)
      if (/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(e.key) || e.key === 'Process') {
        try { el.executeCommand(['switchMode', 'text']); } catch (err) {}
        try { el.executeCommand(['setMode', 'text']); } catch (err) {}
      }

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
          e.stopPropagation(); // Block MathLive shortcut engine
          el.executeCommand(["insert", "\\div"]);
          handleUpdate(e);
        }
        return;
      }

      if (e.key === "*") {
        if (typeof el.executeCommand === 'function') {
          e.preventDefault();
          e.stopPropagation(); // Block MathLive shortcut engine
          el.executeCommand(["insert", "\\times"]);
          handleUpdate(e);
        }
        return;
      }
    };

    el.addEventListener("input", handleUpdate);
    el.addEventListener("change", handleUpdate);
    el.addEventListener("keydown", handleKeyDown, { capture: true }); // Critical: intercept before MathLive
    el.addEventListener("compositionstart", handleCompositionStart);
    el.addEventListener("focus", handleFocus);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("blur", handleUpdate);
    
    // Initial sync
    handleUpdate(new Event('init'));
    
    return () => {
      el.removeEventListener("input", handleUpdate);
      el.removeEventListener("change", handleUpdate);
      el.removeEventListener("keydown", handleKeyDown, { capture: true });
      el.removeEventListener("compositionstart", handleCompositionStart);
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("pointerup", handlePointerUp);
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
      <div className={cn("relative w-full rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center py-1", containerClassName)}>
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
      onClick={handleManualRefresh}
      className={cn(
        "relative flex flex-col justify-center w-full h-fit rounded-xl group/math bg-slate-50/50 border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all cursor-text py-0 px-0.5 my-0.5", 
        (!multiline || showScrollbar) ? "overflow-x-auto custom-scrollbar" : "overflow-visible h-fit",
        containerClassName
      )}
      style={{ minHeight: 'auto' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        math-field {
          display: block !important;
          width: ${(multiline && !showScrollbar) ? '100%' : 'max-content'} !important;
          min-width: 100% !important;
          height: auto !important;
          background: transparent !important;
          overflow: visible !important;
          min-height: 0 !important;
        }
        math-field::part(container) {
          padding: 2px 4.5rem 2px 0.5rem !important; 
          overflow: visible !important;
          cursor: text !important;
          min-height: 0 !important;
          display: flex !important;
          align-items: center !important;
          line-height: 1 !important;
        }
        math-field .ML__base {
          display: flex !important;
          flex-wrap: ${multiline ? 'wrap' : 'nowrap'} !important;
          width: 100% !important;
          line-height: inherit !important;
          padding: 0 !important;
          margin-top: -2px !important;
          margin-bottom: -2px !important;
        }
        math-field .ML__content {
          display: ${multiline ? 'block' : 'inline-block'} !important;
          width: 100% !important;
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
      <div className="relative group w-full">
        <math-field
          ref={(el: any) => {
            mfRef.current = el;
            if (el !== mfElement) setMfElement(el);
          }}
          tabIndex={0}
          className={cn(
            "w-full bg-transparent outline-none transition-all math-field-compact",
            className
          )}
          style={{ 
            fontSize: isTeacher ? '1.1rem' : '1.75rem',
            padding: '0px',
            minHeight: 'auto',
            background: 'transparent',
            border: 'none',
            display: 'block'
          }}
          multiline={multiline ? "true" : "false"}
          math-virtual-keyboard-policy="manual"
          virtual-keyboard-toggle="hidden"
          menu-icon="none"
          keypress-sound="none"
          plonk-sound="none"
          placeholder={placeholder}
        >
          {toMathLiveValue(value)}
        </math-field>
      </div>
      
      {!isTeacher && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10 p-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleManualRefresh();
            }}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all border-2 border-slate-200"
            title="입력기 새로고침"
          >
            <RefreshCw size={24} />
          </button>
          
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleManualRefresh();
              }}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-md border-2 border-indigo-100"
              title="수식 키보드 열기"
            >
              <Keyboard size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
