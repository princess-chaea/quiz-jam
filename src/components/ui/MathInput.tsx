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
  const modalMfRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const { activeField, openKeypad, closeKeypad } = useMathKeypad();
  const [isReady, setIsReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMathModal, setShowMathModal] = useState(false);
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);
  const forceFocus = (mathFieldEl: any) => {
    if (!mathFieldEl) return;
    if (typeof mathFieldEl.focus === 'function') {
      mathFieldEl.focus();
    }
  };

  const handleShowKeypad = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mfRef.current) return;
    
    // Ensure focused first
    mfRef.current.focus();
    
    // Explicitly open custom keypad
    openKeypad(mfRef.current, level);
  };

  const handleManualRefresh = () => {
    if (mfRef.current) {
      mfRef.current.blur();
      setTimeout(() => {
        mfRef.current?.focus();
        if (onRefresh) onRefresh();
      }, 50);
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
          mfElementClass.mathVirtualKeyboardPolicy = 'manual'; // GLOBAL POLICY
        }

        // Disable smart fraction conversion and other auto-conversions if desired
        mfRef.current.setOptions({
          smartFraction: true, // Allow automatic fraction creation
          smartMode: true,
          smartSubsup: true,
          defaultMode: 'math',
          virtualKeyboardToggle: 'hidden',
          virtualKeyboardMode: 'manual',
          menuIcon: 'none',
          keypressSound: 'none',
          plonkSound: 'none',
          soundsDirectory: null,
          onKeystroke: (mf: any, keystroke: string, ev: KeyboardEvent) => {
            // Keep Enter and Tab for navigation
            if (keystroke === 'Enter') return true;
            if (keystroke === 'Tab') return true;
            return true;
          }
        });
        
        // Also set as attributes for double safety
        mfRef.current.setAttribute("keypress-sound", "none");
        mfRef.current.setAttribute("plonk-sound", "none");
        mfRef.current.setAttribute("inputmode", "text"); // Force native keyboard
        mfRef.current.setAttribute("tabindex", "0");
        mfRef.current.readOnly = false; // MUST BE FALSE FOR INTERACTION
        
        const updateInternalTextarea = () => {
          try {
            const textarea = mfRef.current.shadowRoot?.querySelector('textarea') as any;
            if (textarea && !textarea.dataset.keyboardPatched) {
              textarea.dataset.keyboardPatched = 'true';
              textarea.setAttribute('inputmode', 'text');
              textarea.setAttribute('enterkeyhint', 'done');

              // SYNCHRONOUS INTERCEPTION (route 1): Monkey-patch setAttribute
              // Blocks MathLive's textarea.setAttribute('inputmode', 'none') calls.
              const origSetAttribute = textarea.setAttribute.bind(textarea);
              textarea.setAttribute = function(name: string, value: string) {
                if (name === 'inputmode' && (value === 'none' || value === '')) {
                  origSetAttribute('inputmode', 'text');
                } else {
                  origSetAttribute(name, value);
                }
              };

              // SYNCHRONOUS INTERCEPTION (route 2): Override inputMode property
              // Blocks MathLive's textarea.inputMode = 'none' property assignments.
              try {
                Object.defineProperty(textarea, 'inputMode', {
                  configurable: true,
                  get() { return this.getAttribute('inputmode') || 'text'; },
                  set(val: string) {
                    if (val === 'none' || val === '') {
                      origSetAttribute('inputmode', 'text');
                    } else {
                      origSetAttribute('inputmode', val);
                    }
                  }
                });
              } catch (propErr) {}
            }
          } catch (err) {}
        };


        // Multiple attempts to ensure the shadow DOM is ready
        setTimeout(updateInternalTextarea, 300);
        setTimeout(updateInternalTextarea, 1000);
        setTimeout(updateInternalTextarea, 3000);
        
        // IMPORTANT: Set policies on the math-field element to favor native keyboard
        if (mfRef.current) {
          mfRef.current.mathVirtualKeyboardPolicy = 'manual';
          // Force global virtual keyboard to manual mode
          try {
             // @ts-ignore
             if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.policy = 'manual';
          } catch(e) {}
        }
        
        updateInternalTextarea();
        // Sometimes the shadow DOM isn't fully ready immediately
        setTimeout(updateInternalTextarea, 500);
        
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

  // NOTE: We intentionally do NOT auto-focus here on mobile.
  // Calling .focus() programmatically (without user gesture) causes Android Chrome
  // to enter a "focused but no keyboard" state, after which user taps are ignored.
  // The user must tap directly on the math field to trigger the keyboard.


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
      if (el) {
        // Ensure inputMode is set on both the math-field and internal textarea.
        // Keyboard triggering is done in onPointerDown (user gesture context).
        // Here we just ensure attributes are correct after focus is established.
        el.inputMode = 'text';
        try {
          const textarea = el.shadowRoot?.querySelector('textarea');
          if (textarea) {
            textarea.setAttribute('inputmode', 'text');
            textarea.setAttribute('enterkeyhint', 'done');
          }
        } catch (e) {}

        // SMART KEYPAD LOGIC: Always show for teachers.
        if (isTeacher) {
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
      // Direct pointer up handling to ensure keypad sync
      if (isTeacher && typeof el.executeCommand === 'function') {
        openKeypad(el, level);
      }
    };

    const handleKeyDown = (e: any) => {
      // Force text mode if a Korean key is pressed (sometimes IME masks this as Process, but we check just in case)
      if (/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(e.key) || e.key === 'Process') {
        try { el.executeCommand(['switchMode', 'text']); } catch (err) {}
        try { el.executeCommand(['setMode', 'text']); } catch (err) {}
      }

      if (e.key === 'Enter') {
        const liveValue = el.getValue?.() || el.value || "";
        const normalizedValue = liveValue.replace(/~/g, ' ').replace(/\\displaylines/g, '').replace(/\\ /g, ' ');
        if (lastValueRef.current !== normalizedValue) {
          lastValueRef.current = normalizedValue;
          onChangeRef.current(normalizedValue);
        }

        if (onEnterRef.current) {
          e.preventDefault();
          // Added a small delay to ensure IME composition is finished before submission
          setTimeout(() => {
            if (onEnterRef.current) onEnterRef.current();
          }, 30);
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

    // MOBILE KEYBOARD: Use CAPTURE phase so this fires BEFORE MathLive's own
    // pointerdown handler (MathLive registers its listeners in connectedCallback,
    // which runs before our useEffect, so it fires first in bubble phase).
    // With capture:true we intercept the event top-down, before MathLive can call
    // textarea.focus() with inputmode='none'.
    const handleNativePointerDown = () => {
      try {
        const textarea = el.shadowRoot?.querySelector('textarea') as any;
        if (textarea) {
          // Install monkey-patch INLINE so it's active before MathLive's handler runs.
          if (!textarea.dataset.keyboardPatched) {
            textarea.dataset.keyboardPatched = 'true';
            const origSetAttr = HTMLElement.prototype.setAttribute.bind(textarea);
            textarea.setAttribute = function(name: string, value: string) {
              if (name === 'inputmode' && (value === 'none' || value === '')) {
                origSetAttr('inputmode', 'text');
              } else {
                origSetAttr(name, value);
              }
            };
            try {
              Object.defineProperty(textarea, 'inputMode', {
                configurable: true,
                get() { return this.getAttribute('inputmode') || 'text'; },
                set(val: string) {
                  if (val === 'none' || val === '') {
                    origSetAttr('inputmode', 'text');
                  } else { origSetAttr('inputmode', val); }
                }
              });
            } catch {}
          }
          // Set inputmode='text' BEFORE focus so keyboard triggers correctly
          textarea.setAttribute('inputmode', 'text');
          textarea.setAttribute('enterkeyhint', 'done');
          // If already focused, blur first so the subsequent focus() triggers the keyboard
          if (document.activeElement === textarea) {
            textarea.blur();
          }
          textarea.focus();
        }
      } catch {}
    };
    // CAPTURE phase: fires before MathLive's bubble-phase listener
    el.addEventListener('pointerdown', handleNativePointerDown, { capture: true });

    
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
      el.removeEventListener('pointerdown', handleNativePointerDown, { capture: true });
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

  // ── STUDENT VIEW ────────────────────────────────────────────────────────────
  // Use a plain <input> so the native mobile keyboard always appears.
  // The math keyboard icon opens a modal with a MathLive editor.
  if (!isTeacher) {
    const handleTextChange = (v: string) => {
      lastValueRef.current = v;
      onChangeRef.current(v);
    };

    const closeModal = () => {
      closeKeypad(); // Always close custom keypad when modal closes
      setShowMathModal(false);
    };

    const handleModalConfirm = () => {
      if (modalMfRef.current) {
        const raw = modalMfRef.current.getValue?.() ?? modalMfRef.current.value ?? '';
        const normalized = raw.replace(/~/g, ' ').replace(/\\displaylines/g, '').replace(/\\ /g, ' ');
        lastValueRef.current = normalized;
        onChangeRef.current(normalized);
      }
      closeModal();
    };

    return (
      <div className={cn("relative w-full", containerClassName)}>
        {/* Plain text input – native keyboard always works */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="text"
            enterKeyHint="done"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onEnterRef.current?.(); }
            }}
            placeholder={placeholder || "답을 입력하세요"}
            className={cn(
              "flex-1 text-2xl md:text-3xl font-bold text-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3",
              "focus:outline-none focus:border-indigo-400 focus:bg-white transition-all",
              className
            )}
          />
          {/* Math keyboard button */}
          <button
            type="button"
            onClick={() => setShowMathModal(true)}
            className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border-2 border-indigo-200"
            title="수식 키보드 열기"
          >
            <Keyboard size={26} />
          </button>
        </div>

        {/* Math input modal */}
        {showMathModal && isReady && (
          <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-indigo-600 text-white px-5 py-4 flex items-center justify-between">
                <h3 className="font-bold text-lg">수식 입력</h3>
                <button onClick={closeModal} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
              </div>
              <div className="p-4">
                <math-field
                  ref={(el: any) => {
                    // isNew guard: only initialize on first mount of this element.
                    // Without this, every re-render resets el.setValue() and erases
                    // whatever the student typed.
                    const isNew = el !== null && el !== modalMfRef.current;
                    modalMfRef.current = el;
                    if (isNew) {
                      el.mathVirtualKeyboardPolicy = 'manual';
                      el.setValue(toMathLiveValue(value));
                      setTimeout(() => {
                        el.focus();
                        // Open our custom grade keypad (zIndex:10000 > modal z-[9999])
                        openKeypad(el, level);
                      }, 80);
                    }
                  }}
                  virtual-keyboard-mode="manual"
                  math-virtual-keyboard-policy="manual"
                  virtual-keyboard-policy="manual"
                  className="w-full text-2xl bg-slate-50 rounded-xl border-2 border-slate-200 p-4 focus:border-indigo-400 outline-none block"
                  style={{ minHeight: '4rem' }}
                />
              </div>
              <div className="flex gap-3 px-4 pb-5">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 transition-all"
                >취소</button>
                <button
                  onClick={handleModalConfirm}
                  className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-all"
                >확인</button>
              </div>
            </div>
          </div>
        )}

        {/* Show loading only if modal is about to open but MathLive not ready yet */}
        {showMathModal && !isReady && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-slate-500">수식 편집기 로드 중...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── TEACHER VIEW ─────────────────────────────────────────────────────────────
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
      className={cn(
        "relative flex flex-col justify-center w-full h-fit rounded-xl group/math bg-slate-50/50 border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all cursor-text py-0 px-0.5 my-0.5", 
        (!multiline || showScrollbar) ? "overflow-x-auto custom-scrollbar" : "overflow-visible h-fit",
        containerClassName
      )}
      style={{ minHeight: 'auto' }}
      onPointerDown={() => {
        try { mfRef.current?.focus(); } catch {}
      }}
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
          pointer-events: auto !important; /* Enable interaction */
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        math-field::part(container) {
          padding: 6px 4.5rem 6px 1rem !important; 
          overflow: visible !important;
          min-height: 0 !important;
          display: flex !important;
          align-items: center !important;
        }
        math-field::part(content) {
          outline: none !important;
        }
        math-field .ML__base {
          display: flex !important;
          flex-wrap: ${multiline ? 'wrap' : 'nowrap'} !important;
          width: 100% !important;
          line-height: inherit !important;
          padding: 0 !important;
        }
        /* Hide MathLive internal virtual keyboard toggle and menu toggles */
        math-field::part(virtual-keyboard-toggle),
        math-field::part(menu-toggle) {
          display: none !important;
          visibility: hidden !important;
        }
        /* Style placeholders to be more visible */
        math-field::part(placeholder) {
          color: #cbd5e1 !important;
          opacity: 1 !important;
        }
      `}} />
      
      <div className="relative group w-full flex items-center">
        {/* MathField for Direct Interaction */}
        <math-field
          ref={(el: any) => {
            mfRef.current = el;
            if (el !== mfElement) setMfElement(el);
          }}
          className={cn(
            "w-full bg-transparent outline-none transition-all math-field-compact relative z-10",
            className
          )}
          style={{ 
            fontSize: isTeacher ? '1.1rem' : '1.75rem', // Slightly larger for students
            padding: '0px',
            minHeight: 'auto',
            display: 'block'
          }}
          placeholder={placeholder}
          tabIndex={0}
          role="textbox"
          inputMode="text"
          inputmode="text"
          virtual-keyboard-mode="manual"
          math-virtual-keyboard-policy="manual"
          virtual-keyboard-policy="manual"
          onPointerDown={(e: any) => {
            // ORIGINAL WORKING APPROACH: directly focus the shadow DOM textarea
            // synchronously within the user gesture → Android native keyboard triggers.
            // This is the most reliable path; the container's handler is a backup
            // for taps in padding areas above/below the math content.
            try {
              const textarea = e.currentTarget.shadowRoot?.querySelector('textarea') as HTMLElement | null;
              if (textarea) {
                textarea.setAttribute('inputmode', 'text');
                textarea.focus(); // ← within user gesture: keyboard triggers on Android
              } else {
                e.currentTarget.focus();
              }
            } catch {
              try { e.currentTarget.focus(); } catch {}
            }
            if (isTeacher) openKeypad(mfRef.current, level);
          }}
          onClick={(e: any) => {
            e.currentTarget.focus();
          }}
          onFocus={() => {
            if (isTeacher) openKeypad(mfRef.current, level);
          }}
        >
          {toMathLiveValue(value)}
        </math-field>
      </div>
    </div>
  );
}

