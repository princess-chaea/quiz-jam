"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = { id: string; label: string; keys: { label: string; latex: string }[] };

// ── Korean IME ────────────────────────────────────────────────────────────────
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_I:  Record<string,number> = Object.fromEntries(CHO.map((c,i)=>[c,i]));
const JUNG_I: Record<string,number> = Object.fromEntries(JUNG.map((c,i)=>[c,i]));
const JONG_I: Record<string,number> = Object.fromEntries(JONG.map((c,i)=>[c,i]));
const JONG_PAIR: Record<string,number> = { 'ㄱ+ㅅ':3,'ㄴ+ㅈ':5,'ㄴ+ㅎ':6,'ㄹ+ㄱ':9,'ㄹ+ㅁ':10,'ㄹ+ㅂ':11,'ㄹ+ㅅ':12,'ㄹ+ㅌ':13,'ㄹ+ㅍ':14,'ㄹ+ㅎ':15,'ㅂ+ㅅ':18 };
const JONG_SPLIT: Record<number,[number,string]> = { 3:[1,'ㅅ'],5:[4,'ㅈ'],6:[4,'ㅎ'],9:[8,'ㄱ'],10:[8,'ㅁ'],11:[8,'ㅂ'],12:[8,'ㅅ'],13:[8,'ㅌ'],14:[8,'ㅍ'],15:[8,'ㅎ'],18:[17,'ㅅ'] };
const JUNG_PAIR: Record<string,number> = { 'ㅗ+ㅏ':9,'ㅗ+ㅐ':10,'ㅗ+ㅣ':11,'ㅜ+ㅓ':14,'ㅜ+ㅔ':15,'ㅜ+ㅣ':16,'ㅡ+ㅣ':19 };

type S = { cho:number; jung:number; jong:number } | null;
function syl(c:number,j:number,jj=0){ return String.fromCharCode(0xAC00+(c*21+j)*28+jj); }
function toChar(s:S):string {
  if(!s) return '';
  if(s.jung<0) return CHO[s.cho];
  return s.jong===0 ? syl(s.cho,s.jung) : syl(s.cho,s.jung,s.jong);
}

function applyIME(s:S, jamo:string): { fin:string; next:S } {
  const isV = jamo in JUNG_I;
  if (!isV) {
    const ci = CHO_I[jamo], ji = JONG_I[jamo]??0;
    if(!s) return { fin:'', next: ci!==undefined ? {cho:ci,jung:-1,jong:0} : null };
    if(s.jung<0) return { fin:CHO[s.cho], next: ci!==undefined ? {cho:ci,jung:-1,jong:0} : null };
    if(s.jong===0) {
      if(ji>0) return { fin:'', next:{...s,jong:ji} };
      return { fin:syl(s.cho,s.jung), next: ci!==undefined ? {cho:ci,jung:-1,jong:0} : null };
    }
    const key=`${JONG[s.jong]}+${jamo}`;
    if(JONG_PAIR[key]!==undefined) return { fin:'', next:{...s,jong:JONG_PAIR[key]} };
    return { fin:syl(s.cho,s.jung,s.jong), next: ci!==undefined ? {cho:ci,jung:-1,jong:0} : null };
  } else {
    const vi = JUNG_I[jamo];
    if(!s) return { fin:'', next:{cho:11,jung:vi,jong:0} };
    if(s.jung<0) return { fin:'', next:{...s,jung:vi} };
    if(s.jong===0) {
      const key=`${JUNG[s.jung]}+${jamo}`;
      if(JUNG_PAIR[key]!==undefined) return { fin:'', next:{...s,jung:JUNG_PAIR[key]} };
      return { fin:syl(s.cho,s.jung), next:{cho:11,jung:vi,jong:0} };
    }
    const sp=JONG_SPLIT[s.jong];
    if(sp) return { fin:syl(s.cho,s.jung,sp[0]), next:{cho:CHO_I[sp[1]]??11,jung:vi,jong:0} };
    return { fin:syl(s.cho,s.jung,0), next:{cho:CHO_I[JONG[s.jong]]??11,jung:vi,jong:0} };
  }
}

function simplifyState(s:S):S {
  if(!s) return null;
  if(s.jong>0) {
    const sp=JONG_SPLIT[s.jong];
    return sp ? {...s,jong:sp[0]} : {...s,jong:0};
  }
  if(s.jung>=0) return {cho:s.cho,jung:-1,jong:0};
  return null;
}

// QWERTY rows
const R1=['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'];
const R2=['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'];
const R3=['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'];
const S1=['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','','','','ㅒ','ㅖ'];
const UNITS=['cm','km','m','g','kg','mL','L','원','개','명','마리','번','초','분'];

function KoreanKeyboard({ onInsert, onCmd }: { onInsert:(l:string)=>void; onCmd:(c:string)=>void }) {
  const [s, setS] = useState<S>(null);
  const [shift, setShift] = useState(false);

  function tap(jamo:string) {
    if(!jamo) return;
    const {fin, next} = applyIME(s, jamo);
    // Remove current composing from MathLive
    if(s !== null) onCmd('deleteBackward');
    // Insert any finalized character
    if(fin) onInsert(`\\text{${fin}}`);
    // Insert new composing character
    if(next !== null) onInsert(`\\text{${toChar(next)}}`);
    setS(next);
    setShift(false);
  }

  function bsp() {
    if(s !== null) {
      onCmd('deleteBackward'); // remove composing from MathLive
      const simplified = simplifyState(s);
      if(simplified !== null) onInsert(`\\text{${toChar(simplified)}}`);
      setS(simplified);
    } else {
      onCmd('deleteBackward');
    }
  }

  function spc() {
    if(s !== null) { onCmd('deleteBackward'); onInsert(`\\text{${toChar(s)}}`); setS(null); }
    onInsert('\\ ');
  }

  function clear() {
    if(s !== null) { onCmd('deleteBackward'); setS(null); }
  }

  const b = "h-10 flex-1 bg-white border-b-[3px] border-slate-300 rounded-lg text-base font-bold text-slate-800 active:border-b-0 active:translate-y-0.5 transition-all shadow-sm select-none";
  const g = "h-10 bg-slate-100 border-b-[3px] border-slate-200 rounded-lg text-sm font-bold text-slate-500 active:border-b-0 transition-all shadow-sm select-none";

  return (
    <div className="px-2 pb-1 flex flex-col gap-1">
      {/* Quick units */}
      <div className="flex flex-wrap gap-1">
        {UNITS.map(u=>(
          <button key={u} onPointerDown={e=>e.preventDefault()} onClick={()=>{
            if(s!==null){onCmd('deleteBackward');onInsert(`\\text{${toChar(s)}}`);setS(null);}
            onInsert(`\\text{${u}}`);
          }} className="h-8 px-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all">{u}</button>
        ))}
      </div>
      {/* Row 1 */}
      <div className="flex gap-1">
        {R1.map((c,i)=>{ const ch=shift&&S1[i]?S1[i]:c; return <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>tap(ch)} className={b}>{ch}</button>; })}
      </div>
      {/* Row 2 */}
      <div className="flex gap-1 px-3">
        {R2.map(c=><button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>tap(c)} className={b}>{c}</button>)}
      </div>
      {/* Row 3 */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setShift(v=>!v)}
          className={cn(g,'w-10 flex-none text-sm',shift&&'bg-indigo-100 border-indigo-300 text-indigo-700')}>⇧</button>
        {R3.map(c=><button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>tap(c)} className={b}>{c}</button>)}
        <button onPointerDown={e=>e.preventDefault()} onClick={bsp} className={cn(g,'w-10 flex-none text-base text-red-500 border-red-200')}>⌫</button>
      </div>
      {/* Row 4 */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={clear} className={cn(g,'w-14 flex-none text-xs')}>지우기</button>
        <button onPointerDown={e=>e.preventDefault()} onClick={spc} className={cn(g,'flex-1')}>space</button>
      </div>
    </div>
  );
}

export function StudentInlineKeypad({ tabs, defaultTab, onInsert, onCmd }: {
  tabs: KeypadTab[]; defaultTab: string;
  onInsert:(l:string)=>void; onCmd:(c:string)=>void;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const isKor = activeTab==='kor';
  const keys = !isKor ? (tabs.find(t=>t.id===activeTab)?.keys??[]) : [];
  const allTabs = [...tabs, {id:'kor',label:'한글',keys:[]}];

  return (
    <div className="px-3 pb-1 flex-shrink-0">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-2">
        {allTabs.map(tab=>(
          <button key={tab.id} onPointerDown={e=>e.preventDefault()} onClick={()=>setActiveTab(tab.id)}
            className={cn('flex-1 py-2 rounded-xl text-sm font-black transition-all',
              activeTab===tab.id?'bg-white text-indigo-600 shadow-md':'text-slate-500 hover:text-slate-700')}>
            {tab.label}
          </button>
        ))}
      </div>
      {isKor ? (
        <KoreanKeyboard onInsert={onInsert} onCmd={onCmd} />
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((key,i)=>(
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

/** @deprecated – use StudentInlineKeypad's 한글 tab */
export function KoreanTextRow({ onInsert }: { onInsert:(t:string)=>void }) { return null; }
