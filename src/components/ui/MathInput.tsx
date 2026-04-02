"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn, hasMathSymbols } from "@/lib/utils";
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
  showScrollbar?: boolean; // New prop to force scrollbar
  forceMathKeypad?: boolean; // New prop to force math keypad for students
  isFirstQuestion?: boolean; // New prop to control keyboard hint visibility
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
}: MathInputProps) {
  const mfRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const { activeField, openKeypad } = useMathKeypad();
  const [isReady, setIsReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!isTeacher && isFirstQuestion) {
      const shownThisSession = sessionStorage.getItem("quiz-jam-keypad-hint-shown");
      if (!shownThisSession) {
        setShowHelp(true);
        const timer = setTimeout(() => {
          setShowHelp(false);
          sessionStorage.setItem("quiz-jam-keypad-hint-shown", "true");
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isTeacher, isFirstQuestion]);

  const dismissHelp = () => {
    setShowHelp(false);
    localStorage.setItem("quiz-jam-focus-help-dismissed", "true");
  };

  const forceFocus = (mathFieldEl: any) => {
    if (!mathFieldEl) return;
    if (typeof mathFieldEl.focus === 'function') {
      mathFieldEl.focus();
    }
    // Extremely aggressive search across the entire shadow DOM (and its sub-trees if any)
    if (mathFieldEl.shadowRoot) {
      // Find ANY element that acts as a text sink (textarea or input or specialized div)
      const sinks = mathFieldEl.shadowRoot.querySelectorAll('textarea, input, [contenteditable="true"], .ML__keyboard-sink, .ML__textarea');
      sinks.forEach((sink: any) => {
        if (typeof sink.focus === 'function') {
          sink.focus({ preventScroll: true });
        }
      });
    }
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
      <div className={cn("relative w-full rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center py-2", containerClassName)}>
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
      onClick={() => mfRef.current && forceFocus(mfRef.current)}
      className={cn(
        "relative flex flex-col justify-center w-full h-fit min-h-[3rem] rounded-2xl group/math bg-slate-50/50 border-2 border-slate-100 focus-within:border-indigo-400 focus-within:bg-white transition-all cursor-text py-0", 
        (!multiline || showScrollbar) ? "overflow-x-auto custom-scrollbar" : "overflow-visible h-fit",
        containerClassName
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        math-field {
          display: block !important;
          width: ${(multiline && !showScrollbar) ? '100%' : 'max-content'} !important;
          min-width: 100% !important;
          height: 100% !important;
          background: transparent !important;
          overflow: visible !important;
        }
        math-field::part(container) {
          padding: 0 3rem 0 1rem !important; 
          overflow: visible !important;
          cursor: text !important;
          min-height: 100% !important;
          display: flex !important;
          align-items: center !important;
        }
        math-field .ML__base {
          display: flex !important;
          flex-wrap: ${multiline ? 'wrap' : 'nowrap'} !important;
          width: 100% !important;
          line-height: inherit !important;
          padding: 4px 0 !important;
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
      <math-field
        ref={(el: any) => {
          mfRef.current = el;
          if (el !== mfElement) setMfElement(el);
        }}
        className={cn("w-full outline-none", className)}
        style={{ 
          flex: 1,
          width: "100%", 
          background: "transparent",
          border: "none",
          fontSize: isTeacher ? "1.125rem" : "1.25rem",
          display: 'block',
          minHeight: isTeacher ? "3rem" : "2.75rem",
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
      
      {!isTeacher && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (showHelp) dismissHelp();
              if (mfRef.current) {
                forceFocus(mfRef.current);
                openKeypad(mfRef.current, level);
              }
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-600 transition-all shadow-sm border border-indigo-100 z-10"
            title="수식 키보드 열기"
          >
            <Keyboard size={20} />
          </button>

          {showHelp && (
            <div className="absolute right-0 bottom-full mb-3 z-50 animate-tip-pop pointer-events-none">
              <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl min-w-[180px] relative">
                <p className="text-xs font-black leading-snug">
                  수학 문제를 풀 때<br/>
                  사용해요!
                </p>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-indigo-600 rotate-45" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
