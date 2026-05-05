"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMathKeypad } from "./MathKeypadContext";
import { cn, hasMathSymbols } from "@/lib/utils";
import { Keyboard } from "lucide-react";
import { StudentInlineKeypad, KoreanTextRow, type KeypadTab } from "./StudentInlineKeypad";

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
  // Main screen: text input (native keyboard) + ⌨ button
  // Math button opens a bottom-sheet modal with:
  //   • visible MathLive editor (focus() works because it IS visible)
  //   • inline keypad buttons (no floating popup / MathKeypadContext)
  //   • OK / Cancel
  if (!isTeacher) {
    // 기호·단위 탭: 모든 연산자 + 공통 수식(분수,괄호) + 모든 단위 통합
    const SYMS = [
      // 사칙연산 & 비교
      { label: '+',    latex: '+' },         { label: '-',    latex: '-' },
      { label: '×',    latex: '\\times' },   { label: '÷',    latex: '\\div' },
      { label: '=',    latex: '=' },         { label: '≠',    latex: '\\neq' },
      { label: '>',    latex: '>' },         { label: '<',    latex: '<' },
      { label: '≤',    latex: '\\le' },      { label: '≥',    latex: '\\ge' },
      { label: '%',    latex: '\\%' },       { label: '.',    latex: '.' },
      // 필수 수식 구조
      { label: '□/□',  latex: '\\frac{#?}{#?}' }, { label: '□□/□', latex: '#?\\frac{#?}{#?}' },
      { label: '( )',  latex: '(#?)' },      { label: '[ ]',  latex: '[#?]' },
      // 단위: 개수/사람
      { label: '개',   latex: '\\text{개}' }, { label: '명',   latex: '\\text{명}' },
      { label: '마리', latex: '\\text{마리}' }, { label: '원',   latex: '\\text{원}' },
      { label: '번',   latex: '\\text{번}' }, { label: '권',   latex: '\\text{권}' },
      // 단위: 길이/무게/부피
      { label: 'mm',   latex: '\\text{mm}' }, { label: 'cm',   latex: '\\text{cm}' },
      { label: 'm',    latex: '\\text{m}' },  { label: 'km',   latex: '\\text{km}' },
      { label: 'g',    latex: '\\text{g}' },  { label: 'kg',   latex: '\\text{kg}' },
      { label: 't',    latex: '\\text{t}' },  { label: 'mL',   latex: '\\text{mL}' },
      { label: 'L',    latex: '\\text{L}' },
      // 단위: 시간/각도
      { label: '초',   latex: '\\text{초}' }, { label: '분',   latex: '\\text{분}' },
      { label: '시간', latex: '\\text{시간}' }, { label: '°',    latex: '^\\circ' },
    ];
    // 초등 수식: 도형 및 초등 특화 기호
    const ELEM = [
      { label: '□:□',  latex: '#? : #?' },   { label: '∠',    latex: '\\angle' },
      { label: '△',    latex: '\\triangle' }, { label: '□',    latex: '\\square' },
      { label: 'cm²',  latex: '\\text{cm}^2' }, { label: 'm²',   latex: '\\text{m}^2' },
      { label: 'km²',  latex: '\\text{km}^2' }, { label: '□□°',  latex: '#?^\\circ' },
    ];
    // 중등 수식: 거듭제곱, 루트, 집합 등
    const MID = [
      { label: 'xⁿ',    latex: '#?^{#?}' },    { label: 'xₙ',    latex: '#?_{#?}' },
      { label: '√',     latex: '\\sqrt{#?}' },   { label: '|□|',   latex: '|#?|' },
      { label: 'π',     latex: '\\pi' },         { label: '∞',     latex: '\\infty' },
      { label: 'f(x)',  latex: 'f(x)' },       { label: '(x,y)',  latex: '(x,y)' },
      { label: '∝',     latex: '\\propto' },    { label: '∼',      latex: '\\sim' },
      { label: '⊥',     latex: '\\perp' },      { label: '∥',      latex: '\\parallel' },
      { label: '≡',     latex: '\\equiv' },     { label: '±',      latex: '\\pm' },
      { label: '∈',     latex: '\\in' },        { label: '⊂',      latex: '\\subset' },
      { label: '{ }',   latex: '\\{#?\\}' },   { label: 'P(A)',   latex: 'P(A)' },
      { label: 'cm³',   latex: '\\text{cm}^3' }, { label: 'm³',     latex: '\\text{m}^3' },
      { label: 'km/h',  latex: '\\text{km/h}' }, { label: 'm/s',    latex: '\\text{m/s}' },
      { label: '°C',    latex: '^\\circ\\text{C}' },
    ];
    // 고등: 해석·삼각함수·벡터·통계·지수로그 + 고등 수준 단위
    const HIGH = [
      // 수학 기호
      { label: 'lim',    latex: '\\lim_{#? \\to #?}' }, { label: 'Σ',    latex: '\\sum_{#?}^{#?}' },
      { label: '∫',      latex: '\\int_{#?}^{#?}' },   { label: "f'(x)",  latex: "f'(x)" },
      { label: 'dy/dx',  latex: '\\frac{dy}{dx}' },   { label: 'sin',    latex: '\\sin' },
      { label: 'cos',    latex: '\\cos' },              { label: 'tan',    latex: '\\tan' },
      { label: 'θ',      latex: '\\theta' },            { label: 'log',    latex: '\\log_{#?}{#?}' },
      { label: 'ln',     latex: '\\ln{#?}' },          { label: 'eˣ',    latex: 'e^{#?}' },
      { label: 'ⁿ√',     latex: '\\sqrt[#?]{#?}' },  { label: 'vec',    latex: '\\vec{#?}' },
      { label: 'AB→',    latex: '\\overrightarrow{#?}' }, { label: 'σ',   latex: '\\sigma' },
      { label: 'x̄',     latex: '\\bar{x}' },          { label: 'nPr',    latex: '_{#?}P_{#?}' },
      { label: 'nCr',    latex: '_{#?}C_{#?}' },       { label: 'E(X)',   latex: 'E(X)' },
      // 단위 (고등/과학)
      { label: 'rad',    latex: '\\text{rad}' },       { label: 'Pa',     latex: '\\text{Pa}' },
      { label: 'N',      latex: '\\text{N}' },          { label: 'J',      latex: '\\text{J}' },
      { label: 'W',      latex: '\\text{W}' },          { label: 'mol',    latex: '\\text{mol}' },
      { label: 'A',      latex: '\\text{A}' },          { label: 'V',      latex: '\\text{V}' },
      { label: 'K',      latex: '\\text{K}' },          { label: 'dB',     latex: '\\text{dB}' },
    ];
    const TABS: KeypadTab[] = [
      { id: 'sym',  label: '기호·단위', keys: SYMS },
      { id: 'elem', label: '초등', keys: ELEM },
      { id: 'mid',  label: '중등', keys: MID  },
      { id: 'high', label: '고등', keys: HIGH },
    ];

    const isLatexValue = value.includes('\\') || value.includes('{');

    const handleTextChange = (v: string) => {
      lastValueRef.current = v;
      onChangeRef.current(v);
    };

    const handleClear = () => {
      lastValueRef.current = '';
      onChangeRef.current('');
    };

    const openMathModal = () => {
      setShowMathModal(true);
      setTimeout(() => {
        if (modalMfRef.current) {
          const el = modalMfRef.current;
          el.mathVirtualKeyboardPolicy = 'manual'; // prevent auto-show on focus
          // 암시적 곱셈 시각화 완전 제거
          el.setOptions({
            computeImplicitMultiply: () => null,
            contentEditableClearButton: 'never',
            smartMode: false,
            smartFence: false,
          });
          el.setValue(toMathLiveValue(value));
          // Suppress implicit multiply symbol display
          try { el.setOptions?.({ implicitMultiply: '' }); } catch {}
          el.focus();
        }
      }, 120);
    };

    const closeMathModal = () => setShowMathModal(false);

    const handleModalConfirm = () => {
      if (modalMfRef.current) {
        const raw: string = modalMfRef.current.getValue?.() ?? '';
        const normalized = raw
          // Remove ALL implicit \times / \cdot that MathLive inserts:
          // 1. Before any LaTeX command (\frac, \sqrt, \pi, etc.)
          .replace(/\\(?:times|cdot)(?=\\)/g, ' ')
          // 2. After any closing } before another command
          .replace(/\}\s*\\(?:times|cdot)\s*(?=\\)/g, '} ')
          // 3. Trailing × / · at end of string
          .replace(/\\(?:times|cdot)\s*$/g, '')
          // 4. Between atoms (digit / letter) or after closing brace
          .replace(/\}\s*\\(?:times|cdot)\s*/g, '} ')
          .replace(/(\d|(?:\text\{.*?\}))\s*\\(?:times|cdot)\s*(\d|\\text\{)/g, '$1 $2')
          // General cleanup
          .replace(/~/g, ' ')
          .replace(/\\displaylines/g, '')
          .replace(/\\ /g, ' ')
          .trim();
        lastValueRef.current = normalized;
        onChangeRef.current(normalized);
      }
      closeMathModal();
    };

    // Inline keypad actions
    const kpInsert = (latex: string) => {
      const el = modalMfRef.current;
      if (!el) return;
      el.executeCommand(['insert', latex, { focus: true, feedback: true }]);
      setTimeout(() => el.focus(), 0);
    };
    const kpCmd = (name: string) => {
      const el = modalMfRef.current;
      if (!el) return;
      el.executeCommand([name]);
      setTimeout(() => el.focus(), 0);
    };
    // For Korean IME: direct field access
    const kpGetValue = (): string => modalMfRef.current?.getValue?.('latex') ?? '';
    const kpSetValue = (latex: string) => {
      const el = modalMfRef.current;
      if (el) { el.setValue(latex); el.focus(); }
    };

    return (
      <div className={cn('relative w-full', containerClassName)}>

        {/* ── Main input row ── */}
        <div className="flex items-center gap-2">

          {isLatexValue ? (
            // Rendered formula display (readonly)
            <div
              className={cn(
                'flex-1 min-h-[3.5rem] flex items-center justify-center gap-2',
                'bg-slate-50 border-2 border-indigo-300 rounded-2xl px-4 cursor-pointer',
                'hover:border-indigo-400 hover:bg-white transition-all select-none',
                className
              )}
              onPointerDown={(e) => { e.preventDefault(); openMathModal(); }}
              title="수식을 눌러 편집"
            >
              <math-field
                key={value}
                ref={(el: any) => {
                  if (!el) return;
                  // Apply options BEFORE setting value so no implicit × appears
                  try { el.setOptions?.({ implicitMultiply: '' }); } catch {}
                  el.setValue(value);
                }}
                readonly
                style={{ fontSize: '1.75rem', background: 'transparent', border: 'none', outline: 'none', pointerEvents: 'none' }}
              />
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(); }}
                className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 text-xl leading-none"
                title="지우기"
              >✕</button>
            </div>
          ) : (
            // Plain text input – native keyboard
            <input
              type="text"
              inputMode="text"
              enterKeyHint="done"
              value={value}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onEnterRef.current?.(); }
              }}
              placeholder={placeholder || '답을 입력하세요'}
              className={cn(
                'flex-1 text-2xl md:text-3xl font-bold text-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3',
                'focus:outline-none focus:border-indigo-400 focus:bg-white transition-all',
                className
              )}
            />
          )}

          {/* Math keyboard button */}
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={openMathModal}
            className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border-2 border-indigo-200"
            title="수식 키보드 열기"
          >
            <Keyboard size={26} />
          </button>
        </div>

        {/* ── Bottom-sheet math modal ── */}
        {showMathModal && isReady && (
          <div
            className="fixed inset-0 z-[9999] bg-black/20 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"
            onPointerDown={(e) => { if (e.target === e.currentTarget) closeMathModal(); }}
          >
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: '95vh', minHeight: '60vh' }}>

              {/* Header */}
              <div className="bg-indigo-600 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
                <span className="font-bold text-lg">수식 입력</span>
                <button onPointerDown={(e) => e.preventDefault()} onClick={closeMathModal} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
              </div>

              {/* MathLive editor */}
              <div className="px-4 pt-3 pb-2 flex-shrink-0">
                <style dangerouslySetInnerHTML={{ __html: `
                  .student-modal-mf::part(menu-toggle) { display: none !important; }
                  .student-modal-mf::part(clear-button) { display: none !important; }
                ` }} />
                <math-field
                  ref={(el: any) => { modalMfRef.current = el; }}
                  virtual-keyboard-mode="auto"
                  math-virtual-keyboard-policy="manual"
                  clear-button="never"
                  menu-toggle="none"
                  className="student-modal-mf w-full text-2xl bg-slate-50 rounded-xl border-2 border-slate-200 p-3 outline-none block focus:border-indigo-400"
                  style={{ minHeight: '3rem', fontSize: '1.5rem' }}
                />
              </div>

              {/* Inline keypad – scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <StudentInlineKeypad
                  tabs={TABS}
                  defaultTab={level === 'high' ? 'high' : level === 'middle' ? 'mid' : 'sym'}
                  onInsert={kpInsert}
                  onCmd={kpCmd}
                  getFieldValue={kpGetValue}
                  setFieldValue={kpSetValue}
                />
              </div>

              {/* Footer */}
              <div className="flex gap-2 px-4 pb-4 pt-2 flex-shrink-0">
                <button onPointerDown={(e) => e.preventDefault()} onClick={() => kpCmd('moveToPreviousChar')} className="flex-1 h-10 bg-slate-100 rounded-xl text-slate-600 font-bold text-lg">◀</button>
                <button onPointerDown={(e) => e.preventDefault()} onClick={() => kpCmd('moveToNextChar')} className="flex-1 h-10 bg-slate-100 rounded-xl text-slate-600 font-bold text-lg">▶</button>
                <button onPointerDown={(e) => e.preventDefault()} onClick={closeMathModal} className="flex-[1.5] h-10 bg-slate-100 rounded-xl text-slate-600 font-bold">취소</button>
                <button onPointerDown={(e) => e.preventDefault()} onClick={handleModalConfirm} className="flex-[2] h-10 bg-indigo-600 rounded-xl text-white font-bold shadow-md">확인</button>
              </div>
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

