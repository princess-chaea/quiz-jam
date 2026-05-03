"use client";
import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = { id: string; label: string; keys: { label: string; latex: string }[] };

// ── Korean IME (QWERTY) ───────────────────────────────────────────────────────
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_I:  Record<string,number> = Object.fromEntries(CHO.map((c,i)=>[c,i]));
const JUNG_I: Record<string,number> = Object.fromEntries(JUNG.map((c,i)=>[c,i]));
const JONG_I: Record<string,number> = Object.fromEntries(JONG.map((c,i)=>[c,i]));
const JONG_PAIR: Record<string,number> = {'ㄱ+ㅅ':3,'ㄴ+ㅈ':5,'ㄴ+ㅎ':6,'ㄹ+ㄱ':9,'ㄹ+ㅁ':10,'ㄹ+ㅂ':11,'ㄹ+ㅅ':12,'ㄹ+ㅌ':13,'ㄹ+ㅍ':14,'ㄹ+ㅎ':15,'ㅂ+ㅅ':18};
const JONG_SPLIT: Record<number,[number,string]> = {3:[1,'ㅅ'],5:[4,'ㅈ'],6:[4,'ㅎ'],9:[8,'ㄱ'],10:[8,'ㅁ'],11:[8,'ㅂ'],12:[8,'ㅅ'],13:[8,'ㅌ'],14:[8,'ㅍ'],15:[8,'ㅎ'],18:[17,'ㅅ']};
const JUNG_PAIR: Record<string,number> = {'ㅗ+ㅏ':9,'ㅗ+ㅐ':10,'ㅗ+ㅣ':11,'ㅜ+ㅓ':14,'ㅜ+ㅔ':15,'ㅜ+ㅣ':16,'ㅡ+ㅣ':19};

type S = {cho:number;jung:number;jong:number}|null;
function syl(c:number,j:number,jj=0){return String.fromCharCode(0xAC00+(c*21+j)*28+jj);}
function toChar(s:S):string{
  if(!s)return '';
  if(s.jung<0)return CHO[s.cho];
  return s.jong===0?syl(s.cho,s.jung):syl(s.cho,s.jung,s.jong);
}
function applyIME(s:S,jamo:string):{fin:string;next:S}{
  const isV=jamo in JUNG_I;
  if(!isV){
    const ci=CHO_I[jamo],ji=JONG_I[jamo]??0;
    if(!s)return{fin:'',next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};
    if(s.jung<0)return{fin:CHO[s.cho],next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};
    if(s.jong===0){
      if(ji>0)return{fin:'',next:{...s,jong:ji}};
      return{fin:syl(s.cho,s.jung),next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};
    }
    const key=`${JONG[s.jong]}+${jamo}`;
    if(JONG_PAIR[key]!==undefined)return{fin:'',next:{...s,jong:JONG_PAIR[key]}};
    return{fin:syl(s.cho,s.jung,s.jong),next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};
  }else{
    const vi=JUNG_I[jamo];
    if(!s)return{fin:'',next:{cho:11,jung:vi,jong:0}};
    if(s.jung<0)return{fin:'',next:{...s,jung:vi}};
    if(s.jong===0){
      const key=`${JUNG[s.jung]}+${jamo}`;
      if(JUNG_PAIR[key]!==undefined)return{fin:'',next:{...s,jung:JUNG_PAIR[key]}};
      return{fin:syl(s.cho,s.jung),next:{cho:11,jung:vi,jong:0}};
    }
    const sp=JONG_SPLIT[s.jong];
    if(sp)return{fin:syl(s.cho,s.jung,sp[0]),next:{cho:CHO_I[sp[1]]??11,jung:vi,jong:0}};
    return{fin:syl(s.cho,s.jung,0),next:{cho:CHO_I[JONG[s.jong]]??11,jung:vi,jong:0}};
  }
}
function simplify(s:S):S{
  if(!s)return null;
  if(s.jong>0){const sp=JONG_SPLIT[s.jong];return sp?{...s,jong:sp[0]}:{...s,jong:0};}
  if(s.jung>=0)return{cho:s.cho,jung:-1,jong:0};
  return null;
}

// ── Long-press hook ───────────────────────────────────────────────────────────
function useLongPress(fn:()=>void,delay=120){
  const iv=useRef<ReturnType<typeof setInterval>|null>(null);
  const stop=useCallback(()=>{if(iv.current){clearInterval(iv.current);iv.current=null;}},[]);
  const start=useCallback(()=>{fn();iv.current=setInterval(fn,delay);},[fn,delay]);
  return{onPointerDown:(e:React.PointerEvent)=>{e.preventDefault();start();},onPointerUp:stop,onPointerLeave:stop};
}

// ── Korean QWERTY keyboard ────────────────────────────────────────────────────
const KOR_R1=['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'];
const KOR_R2=['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'];
const KOR_R3=['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'];
const KOR_S1=['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','','','','ㅒ','ㅖ'];
const ENG_R1=['q','w','e','r','t','y','u','i','o','p'];
const ENG_R2=['a','s','d','f','g','h','j','k','l'];
const ENG_R3=['z','x','c','v','b','n','m'];
const NUMS_ROW=['1','2','3','4','5','6','7','8','9','0'];

function KoreanKeyboard({onInsert,onCmd}:{onInsert:(l:string)=>void;onCmd:(c:string)=>void}){
  const [s,setS]=useState<S>(null);          // IME composing state
  const [shift,setShift]=useState(false);
  const [isKor,setIsKor]=useState(true);     // Korean/English toggle

  // Finalize composing char: insert into MathLive and reset
  const finalize=useCallback((state:S)=>{
    if(state!==null){
      onInsert(`\\text{${toChar(state)}}`);
    }
  },[onInsert]);

  function tapKor(jamo:string){
    if(!jamo)return;
    const{fin,next}=applyIME(s,jamo);
    if(fin)onInsert(`\\text{${fin}}`);   // finalized: goes directly into MathLive
    // composing (next) stays in state only — shown as preview, NOT in MathLive
    setS(next);
    setShift(false);
  }

  function tapEng(ch:string){
    finalize(s); setS(null);             // flush any Korean composing first
    const c=shift?ch.toUpperCase():ch;
    onInsert(c);
    setShift(false);
  }

  function tapNum(n:string){
    finalize(s); setS(null);
    onInsert(n);
  }

  function bsp(){
    if(s!==null){
      const prev=simplify(s);
      setS(prev);
      // don't touch MathLive — composing char was never there
    }else{
      onCmd('deleteBackward');
    }
  }

  function clr(){
    // clear composing preview only
    setS(null);
  }

  function spc(){
    finalize(s); setS(null);
    onInsert('\\ ');
  }

  function toggleLang(){
    finalize(s); setS(null);
    setIsKor(v=>!v);
  }

  const bspPress=useLongPress(bsp);

  const K="h-9 flex-1 bg-white/10 border border-white/20 rounded-lg text-sm font-bold text-white active:bg-indigo-500 transition-all shadow-sm select-none";
  const G="h-9 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300 active:bg-indigo-500 transition-all shadow-sm select-none";

  const composing=toChar(s);

  return(
    <div className="px-2 pb-1 flex flex-col gap-1 bg-slate-700 rounded-xl p-2">
      {/* Composing preview chip */}
      <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
        <span className="text-xs text-slate-400">
          {isKor?'한국어':'English'} {composing&&<>조합 중: <span className="text-indigo-300 font-bold text-sm">{composing}</span></>}
        </span>
        <button onPointerDown={e=>e.preventDefault()} onClick={toggleLang}
          className="px-3 h-7 rounded-lg bg-indigo-600/50 text-xs font-bold text-white hover:bg-indigo-600 transition-all">
          {isKor?'한→A':'A→한'}
        </button>
      </div>

      {/* Number row */}
      <div className="flex gap-1">
        {NUMS_ROW.map(n=>(
          <button key={n} onPointerDown={e=>e.preventDefault()} onClick={()=>tapNum(n)} className={K}>{n}</button>
        ))}
      </div>

      {/* Row 1 */}
      <div className="flex gap-1">
        {(isKor?KOR_R1:ENG_R1).map((c,i)=>{
          const ch=isKor?(shift&&KOR_S1[i]?KOR_S1[i]:c):(shift?c.toUpperCase():c);
          return <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(ch):tapEng(c)} className={K}>{ch}</button>;
        })}
      </div>

      {/* Row 2 */}
      <div className="flex gap-1 px-3">
        {(isKor?KOR_R2:ENG_R2).map(c=>(
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(c):tapEng(c)} className={K}>
            {!isKor&&shift?c.toUpperCase():c}
          </button>
        ))}
      </div>

      {/* Row 3 with Shift + Backspace */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setShift(v=>!v)}
          className={cn(G,'w-10 flex-none',shift&&'bg-indigo-500/50 text-white')}>⇧</button>
        {(isKor?KOR_R3:ENG_R3).map(c=>(
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(c):tapEng(c)} className={K}>
            {!isKor&&shift?c.toUpperCase():c}
          </button>
        ))}
        <button {...bspPress} className={cn(G,'w-10 flex-none text-red-400 border-red-500/30')}>⌫</button>
      </div>

      {/* Row 4: clear composing + space */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={clr}
          className={cn(G,'w-16 flex-none text-xs')} title="조합 취소">지우기</button>
        <button onPointerDown={e=>e.preventDefault()} onClick={spc} className={cn(G,'flex-1')}>space</button>
      </div>
    </div>
  );
}

// ── Main StudentInlineKeypad ──────────────────────────────────────────────────
export function StudentInlineKeypad({tabs,defaultTab,onInsert,onCmd}:{
  tabs:KeypadTab[];defaultTab:string;
  onInsert:(l:string)=>void;onCmd:(c:string)=>void;
}){
  const [activeTab,setActiveTab]=useState(defaultTab);
  const isKor=activeTab==='kor';
  const keys=!isKor?(tabs.find(t=>t.id===activeTab)?.keys??[]):[];
  const allTabs=[...tabs,{id:'kor',label:'한글',keys:[]}];

  const bspPress=useLongPress(()=>onCmd('deleteBackward'));

  return(
    <div className="px-3 pb-1 flex-shrink-0">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-2">
        {allTabs.map(tab=>(
          <button key={tab.id} onPointerDown={e=>e.preventDefault()} onClick={()=>setActiveTab(tab.id)}
            className={cn('flex-1 py-2 rounded-xl text-xs font-black transition-all',
              activeTab===tab.id?'bg-white text-indigo-600 shadow-md':'text-slate-500 hover:text-slate-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {isKor?(
        <KoreanKeyboard onInsert={onInsert} onCmd={onCmd}/>
      ):(
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((key,i)=>(
            <button key={activeTab+i} onPointerDown={e=>e.preventDefault()} onClick={()=>onInsert(key.latex)}
              className="h-10 bg-white border-b-4 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-indigo-50 active:border-b-0 active:translate-y-1 transition-all shadow-sm">
              {key.label}
            </button>
          ))}
          <button {...bspPress}
            className="h-10 bg-red-50 border-b-4 border-red-200 rounded-xl text-sm font-bold text-red-500 hover:bg-red-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm">⌫</button>
          <button onPointerDown={e=>e.preventDefault()} onClick={()=>onCmd('moveToNextPlaceholder')}
            className="h-10 bg-emerald-50 border-b-4 border-emerald-200 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm">Tab</button>
        </div>
      )}
    </div>
  );
}

/** @deprecated */
export function KoreanTextRow({onInsert}:{onInsert:(t:string)=>void}){return null;}
