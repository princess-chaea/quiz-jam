"use client";
import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = {
  id: string;
  label: string;
  keys: { label: string; latex: string }[];
};

// ── Korean QWERTY IME ─────────────────────────────────────────────────────────
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_I:  Record<string,number> = Object.fromEntries(CHO.map((c,i)=>[c,i]));
const JUNG_I: Record<string,number> = Object.fromEntries(JUNG.map((c,i)=>[c,i]));
const JONG_I: Record<string,number> = Object.fromEntries(JONG.map((c,i)=>[c,i]));

const JONG_PAIR: Record<string,number> = {
  'ㄱ+ㅅ':3,'ㄴ+ㅈ':5,'ㄴ+ㅎ':6,
  'ㄹ+ㄱ':9,'ㄹ+ㅁ':10,'ㄹ+ㅂ':11,'ㄹ+ㅅ':12,'ㄹ+ㅌ':13,'ㄹ+ㅍ':14,'ㄹ+ㅎ':15,
  'ㅂ+ㅅ':18,
};
const JONG_SPLIT: Record<number,[number,string]> = {
  3:[1,'ㅅ'],5:[4,'ㅈ'],6:[4,'ㅎ'],
  9:[8,'ㄱ'],10:[8,'ㅁ'],11:[8,'ㅂ'],12:[8,'ㅅ'],13:[8,'ㅌ'],14:[8,'ㅍ'],15:[8,'ㅎ'],
  18:[17,'ㅅ'],
};
const JUNG_PAIR: Record<string,number> = {
  'ㅗ+ㅏ':9,'ㅗ+ㅐ':10,'ㅗ+ㅣ':11,
  'ㅜ+ㅓ':14,'ㅜ+ㅔ':15,'ㅜ+ㅣ':16,
  'ㅡ+ㅣ':19,
};

function syllable(cho:number,jung:number,jong=0) {
  return String.fromCharCode(0xAC00 + (cho*21+jung)*28 + jong);
}

type S = { cho:number; jung:number; jong:number } | null;

function useKoreanIME() {
  const [done, setDone] = useState('');
  const [s, setS] = useState<S>(null);

  const display = done + (s == null ? '' :
    s.jung < 0 ? CHO[s.cho] :
    s.jong === 0 ? syllable(s.cho,s.jung) :
    syllable(s.cho,s.jung,s.jong));

  function press(jamo: string) {
    const isVowel = jamo in JUNG_I;
    if (!isVowel) {
      // consonant
      const ci = CHO_I[jamo]; // may be undefined for ㅃ etc without initial mapping
      const ji = JONG_I[jamo] ?? 0;
      if (s === null) {
        if (ci !== undefined) setS({ cho: ci, jung: -1, jong: 0 });
        else setDone(d => d + jamo);
      } else if (s.jung < 0) {
        // only cho set → flush and start new
        setDone(d => d + CHO[s.cho]);
        setS(ci !== undefined ? { cho: ci, jung: -1, jong: 0 } : null);
        if (ci === undefined) setDone(d => d + jamo);
      } else if (s.jong === 0) {
        // cho+jung, try add jong
        if (ji > 0) setS({ ...s, jong: ji });
        else { setDone(d => d + syllable(s.cho, s.jung)); setS(ci !== undefined ? { cho: ci, jung:-1, jong:0 } : null); }
      } else {
        // cho+jung+jong — try compound jong
        const key = `${JONG[s.jong]}+${jamo}`;
        if (JONG_PAIR[key] !== undefined) {
          setS({ ...s, jong: JONG_PAIR[key] });
        } else {
          setDone(d => d + syllable(s.cho, s.jung, s.jong));
          setS(ci !== undefined ? { cho: ci, jung:-1, jong:0 } : null);
          if (ci === undefined) setDone(d => d + jamo);
        }
      }
    } else {
      // vowel
      const vi = JUNG_I[jamo];
      if (s === null) {
        // ㅇ(11) as silent initial for standalone vowel
        setS({ cho:11, jung:vi, jong:0 });
      } else if (s.jung < 0) {
        setS({ ...s, jung: vi });
      } else if (s.jong === 0) {
        // try vowel compound (ㅗ+ㅏ etc.)
        const key = `${JUNG[s.jung]}+${jamo}`;
        if (JUNG_PAIR[key] !== undefined) setS({ ...s, jung: JUNG_PAIR[key] });
        else { setDone(d => d + syllable(s.cho, s.jung)); setS({ cho:11, jung:vi, jong:0 }); }
      } else {
        // cho+jung+jong + vowel → split jong
        const split = JONG_SPLIT[s.jong];
        if (split) {
          const [leftJong, rightCho] = split;
          setDone(d => d + syllable(s.cho, s.jung, leftJong));
          const newCho = CHO_I[rightCho] ?? 11;
          setS({ cho: newCho, jung: vi, jong: 0 });
        } else {
          const finalCho = CHO_I[JONG[s.jong]] ?? 11;
          setDone(d => d + syllable(s.cho, s.jung, 0));
          setS({ cho: finalCho, jung: vi, jong: 0 });
        }
      }
    }
  }

  function backspace() {
    if (s !== null) {
      if (s.jong > 0) {
        const split = JONG_SPLIT[s.jong];
        if (split) setS({ ...s, jong: split[0] });
        else setS({ ...s, jong: 0 });
      } else if (s.jung >= 0) {
        setS({ ...s, jung: -1 });
      } else {
        setS(null);
      }
    } else if (done.length > 0) {
      setDone(d => d.slice(0, -1));
    }
  }

  function space() {
    if (s !== null) {
      setDone(d => d + (s.jung < 0 ? CHO[s.cho] : s.jong === 0 ? syllable(s.cho,s.jung) : syllable(s.cho,s.jung,s.jong)));
      setS(null);
    }
    setDone(d => d + ' ');
  }

  function getText() {
    if (s === null) return done;
    if (s.jung < 0) return done + CHO[s.cho];
    if (s.jong === 0) return done + syllable(s.cho, s.jung);
    return done + syllable(s.cho, s.jung, s.jong);
  }

  function reset() { setDone(''); setS(null); }

  return { display, press, backspace, space, getText, reset };
}

// QWERTY rows
const ROW1 = ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'];
const ROW2 = ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'];
const ROW3 = ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'];
const S1   = ['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','','','','ㅒ','ㅖ'];
const UNIT_QUICK = ['cm','km','m','g','kg','mL','L','원','개','명','마리','번','초','분'];

// ── Components ───────────────────────────────────────────────────────────────

function KoreanKeyboard({ onInsert }: { onInsert: (latex: string) => void }) {
  const ime = useKoreanIME();
  const [shift, setShift] = useState(false);

  function tap(jamo: string) {
    if (!jamo) return;
    ime.press(jamo);
    setShift(false);
  }

  function insert() {
    const t = ime.getText().trim();
    if (!t) return;
    onInsert(`\\text{${t}}`);
    ime.reset();
  }

  const btnCls = "h-10 flex-1 bg-white border-b-[3px] border-slate-300 rounded-lg text-base font-bold text-slate-800 active:border-b-0 active:translate-y-0.5 transition-all shadow-sm select-none";
  const spcCls = "h-10 bg-slate-100 border-b-[3px] border-slate-200 rounded-lg text-sm font-bold text-slate-500 active:border-b-0 transition-all shadow-sm select-none";

  return (
    <div className="px-2 pb-1 flex flex-col gap-1.5">
      {/* Preview */}
      <div className="flex items-center gap-2 bg-slate-50 border-2 border-indigo-200 rounded-xl px-3 py-2 min-h-[2.5rem]">
        <span className="flex-1 text-base font-bold text-slate-800 tracking-wide">
          {ime.display || <span className="text-slate-300">한글을 입력하세요</span>}
        </span>
        <button onPointerDown={e=>e.preventDefault()} onClick={insert}
          className="px-4 h-8 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex-shrink-0">
          삽입
        </button>
      </div>

      {/* Quick units */}
      <div className="flex flex-wrap gap-1">
        {UNIT_QUICK.map(u => (
          <button key={u} onPointerDown={e=>e.preventDefault()} onClick={() => onInsert(`\\text{${u}}`)}
            className="h-8 px-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all">
            {u}
          </button>
        ))}
      </div>

      {/* Row 1 */}
      <div className="flex gap-1">
        {ROW1.map((c, i) => {
          const ch = shift && S1[i] ? S1[i] : c;
          return (
            <button key={c} onPointerDown={e=>e.preventDefault()} onClick={() => tap(ch)}
              className={btnCls}>{ch}</button>
          );
        })}
      </div>

      {/* Row 2 – slightly indented */}
      <div className="flex gap-1 px-3">
        {ROW2.map(c => (
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={() => tap(c)}
            className={btnCls}>{c}</button>
        ))}
      </div>

      {/* Row 3 with shift + backspace */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={() => setShift(v=>!v)}
          className={cn(spcCls, 'w-10 flex-none text-sm', shift && 'bg-indigo-100 border-indigo-300 text-indigo-700')}>
          ⇧
        </button>
        {ROW3.map(c => (
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={() => tap(c)}
            className={btnCls}>{c}</button>
        ))}
        <button onPointerDown={e=>e.preventDefault()} onClick={() => ime.backspace()}
          className={cn(spcCls, 'w-10 flex-none text-base text-red-500 border-red-200')}>
          ⌫
        </button>
      </div>

      {/* Row 4: space */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={() => { ime.reset(); }}
          className={cn(spcCls, 'w-14 flex-none text-xs')}>지우기</button>
        <button onPointerDown={e=>e.preventDefault()} onClick={() => ime.space()}
          className={cn(spcCls, 'flex-1')}>space</button>
      </div>
    </div>
  );
}

export function StudentInlineKeypad({
  tabs, defaultTab, onInsert, onCmd,
}: {
  tabs: KeypadTab[];
  defaultTab: string;
  onInsert: (latex: string) => void;
  onCmd: (name: string) => void;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const isKorean = activeTab === 'kor';
  const keys = !isKorean ? (tabs.find(t => t.id === activeTab)?.keys ?? []) : [];
  const allTabs = [...tabs, { id: 'kor', label: '한글', keys: [] }];

  return (
    <div className="px-3 pb-1 flex-shrink-0">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-2">
        {allTabs.map(tab => (
          <button key={tab.id} onPointerDown={e=>e.preventDefault()} onClick={()=>setActiveTab(tab.id)}
            className={cn('flex-1 py-2 rounded-xl text-sm font-black transition-all',
              activeTab===tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {isKorean ? (
        <KoreanKeyboard onInsert={onInsert} />
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((key, i) => (
            <button key={activeTab+i} onPointerDown={e=>e.preventDefault()} onClick={()=>onInsert(key.latex)}
              className="h-10 bg-white border-b-4 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-indigo-50 active:border-b-0 active:translate-y-1 transition-all shadow-sm">
              {key.label}
            </button>
          ))}
          <button onPointerDown={e=>e.preventDefault()} onClick={()=>onCmd('deleteBackward')}
            className="h-10 bg-red-50 border-b-4 border-red-200 rounded-xl text-sm font-bold text-red-500 hover:bg-red-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm">⌫</button>
          <button onPointerDown={e=>e.preventDefault()} onClick={()=>onCmd('moveToNextPlaceholder')}
            className="h-10 bg-emerald-50 border-b-4 border-emerald-200 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm">Tab</button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Korean input is now the 한글 tab in StudentInlineKeypad */
export function KoreanTextRow({ onInsert }: { onInsert: (text: string) => void }) {
  return null;
}
