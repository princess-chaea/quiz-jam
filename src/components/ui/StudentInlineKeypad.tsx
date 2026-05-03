"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = { id: string; label: string; keys: { label: string; latex: string }[] };

// ── Korean IME ────────────────────────────────────────────────────────────────
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_I:Record<string,number>=Object.fromEntries(CHO.map((c,i)=>[c,i]));
const JUNG_I:Record<string,number>=Object.fromEntries(JUNG.map((c,i)=>[c,i]));
const JONG_I:Record<string,number>=Object.fromEntries(JONG.map((c,i)=>[c,i]));
const JP:Record<string,number>={'ㄱ+ㅅ':3,'ㄴ+ㅈ':5,'ㄴ+ㅎ':6,'ㄹ+ㄱ':9,'ㄹ+ㅁ':10,'ㄹ+ㅂ':11,'ㄹ+ㅅ':12,'ㄹ+ㅌ':13,'ㄹ+ㅍ':14,'ㄹ+ㅎ':15,'ㅂ+ㅅ':18};
const JS:Record<number,[number,string]>={3:[1,'ㅅ'],5:[4,'ㅈ'],6:[4,'ㅎ'],9:[8,'ㄱ'],10:[8,'ㅁ'],11:[8,'ㅂ'],12:[8,'ㅅ'],13:[8,'ㅌ'],14:[8,'ㅍ'],15:[8,'ㅎ'],18:[17,'ㅅ']};
const VP:Record<string,number>={'ㅗ+ㅏ':9,'ㅗ+ㅐ':10,'ㅗ+ㅣ':11,'ㅜ+ㅓ':14,'ㅜ+ㅔ':15,'ㅜ+ㅣ':16,'ㅡ+ㅣ':19};

type S={cho:number;jung:number;jong:number}|null;
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
    if(s.jong===0){if(ji>0)return{fin:'',next:{...s,jong:ji}};return{fin:syl(s.cho,s.jung),next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};}
    const k=`${JONG[s.jong]}+${jamo}`;
    if(JP[k]!==undefined)return{fin:'',next:{...s,jong:JP[k]}};
    return{fin:syl(s.cho,s.jung,s.jong),next:ci!==undefined?{cho:ci,jung:-1,jong:0}:null};
  }else{
    const vi=JUNG_I[jamo];
    if(!s)return{fin:'',next:{cho:11,jung:vi,jong:0}};
    if(s.jung<0)return{fin:'',next:{...s,jung:vi}};
    if(s.jong===0){const k=`${JUNG[s.jung]}+${jamo}`;if(VP[k]!==undefined)return{fin:'',next:{...s,jung:VP[k]}};return{fin:syl(s.cho,s.jung),next:{cho:11,jung:vi,jong:0}};}
    const sp=JS[s.jong];
    if(sp)return{fin:syl(s.cho,s.jung,sp[0]),next:{cho:CHO_I[sp[1]]??11,jung:vi,jong:0}};
    return{fin:syl(s.cho,s.jung,0),next:{cho:CHO_I[JONG[s.jong]]??11,jung:vi,jong:0}};
  }
}
function simplify(s:S):S{
  if(!s)return null;
  if(s.jong>0){const sp=JS[s.jong];return sp?{...s,jong:sp[0]}:{...s,jong:0};}
  if(s.jung>=0)return{cho:s.cho,jung:-1,jong:0};
  return null;
}

// ── Long-press hook ───────────────────────────────────────────────────────────
function useLongPress(fn:()=>void,ms=120){
  const iv=useRef<ReturnType<typeof setInterval>|null>(null);
  const stop=()=>{if(iv.current){clearInterval(iv.current);iv.current=null;}};
  const start=(e:React.PointerEvent)=>{e.preventDefault();fn();iv.current=setInterval(fn,ms);};
  return{onPointerDown:start,onPointerUp:stop,onPointerLeave:stop};
}

// ── QWERTY rows ───────────────────────────────────────────────────────────────
const KR1=['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'];
const KR2=['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'];
const KR3=['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'];
const KS1=['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','','','','ㅒ','ㅖ'];
const ER1=['q','w','e','r','t','y','u','i','o','p'];
const ER2=['a','s','d','f','g','h','j','k','l'];
const ER3=['z','x','c','v','b','n','m'];
const NR=['1','2','3','4','5','6','7','8','9','0'];

// ── Korean Keyboard ───────────────────────────────────────────────────────────
function KoreanKeyboard({
  onInsert, onCmd, getFieldValue, setFieldValue,
}:{
  onInsert:(l:string)=>void;
  onCmd:(c:string)=>void;
  getFieldValue:()=>string;
  setFieldValue:(l:string)=>void;
}){
  // Korean state: prefix = math before Korean, completed = finalized chars, ime = composing state
  const prefixRef=useRef('');
  const completedRef=useRef('');
  const [ime,setIme]=useState<S>(null);
  const [isKor,setIsKor]=useState(true);
  const [shift,setShift]=useState(false);

  // Called once when this keyboard mounts (Korean tab activated)
  useEffect(()=>{
    prefixRef.current=getFieldValue();
    completedRef.current='';
    setIme(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function updateField(completed:string,state:S){
    const comp=toChar(state);
    const full=completed+comp;
    const latex=full?`${prefixRef.current}\\text{${full}}`:`${prefixRef.current}`;
    setFieldValue(latex);
  }

  function tapKor(jamo:string){
    if(!jamo)return;
    setIme(prev=>{
      const{fin,next}=applyIME(prev,jamo);
      const newCompleted=completedRef.current+fin;
      completedRef.current=newCompleted;
      updateField(newCompleted,next);
      setShift(false);
      return next;
    });
  }

  function tapEng(ch:string){
    // Finalize any Korean composing first
    const comp=toChar(ime);
    const newCompleted=completedRef.current+comp;
    completedRef.current=newCompleted;
    setIme(null);
    // Insert English char into MathLive directly (not as Korean text)
    const finalLatex=newCompleted?`${prefixRef.current}\\text{${newCompleted}}`:`${prefixRef.current}`;
    setFieldValue(finalLatex);
    // Update prefix to include the Korean text, then insert the letter
    prefixRef.current=finalLatex;
    completedRef.current='';
    onInsert(shift?ch.toUpperCase():ch);
    setShift(false);
  }

  function tapNum(n:string){
    const comp=toChar(ime);
    const newCompleted=completedRef.current+comp;
    completedRef.current=newCompleted;
    setIme(null);
    const finalLatex=newCompleted?`${prefixRef.current}\\text{${newCompleted}}`:`${prefixRef.current}`;
    prefixRef.current=finalLatex;
    completedRef.current='';
    setFieldValue(finalLatex);
    onInsert(n);
  }

  function bsp(){
    setIme(prev=>{
      if(prev!==null){
        const simplified=simplify(prev);
        updateField(completedRef.current,simplified);
        return simplified;
      }
      // No composing: remove last char from completed
      if(completedRef.current.length>0){
        const newC=completedRef.current.slice(0,-1);
        completedRef.current=newC;
        updateField(newC,null);
        return null;
      }
      // Delete from prefix
      onCmd('deleteBackward');
      // Re-capture prefix after deletion
      setTimeout(()=>{
        prefixRef.current=getFieldValue();
      },50);
      return null;
    });
  }

  function spc(){
    const comp=toChar(ime);
    const newCompleted=completedRef.current+comp;
    completedRef.current=newCompleted;
    setIme(null);
    const finalLatex=newCompleted?`${prefixRef.current}\\text{${newCompleted}}`:`${prefixRef.current}`;
    prefixRef.current=finalLatex;
    completedRef.current='';
    setFieldValue(finalLatex+'\\ ');
    prefixRef.current=finalLatex+'\\ ';
  }

  function toggleLang(){
    const comp=toChar(ime);
    if(comp){
      const newC=completedRef.current+comp;
      completedRef.current=newC;
      updateField(newC,null);
    }
    setIme(null);
    setIsKor(v=>!v);
    setShift(false);
  }

  const bspLP=useLongPress(bsp);
  const K='h-10 flex-1 bg-slate-100 border-b-[3px] border-slate-300 rounded-xl text-base font-bold text-slate-800 active:bg-indigo-200 transition-all shadow-sm select-none';
  const G='h-10 bg-slate-200 border-b-[3px] border-slate-300 rounded-xl text-sm font-bold text-slate-600 active:bg-slate-300 transition-all shadow-sm select-none';

  return(
    <div className="flex flex-col gap-1.5 px-2 pb-1">
      {/* Numbers row */}
      <div className="flex gap-1">
        {NR.map(n=><button key={n} onPointerDown={e=>e.preventDefault()} onClick={()=>tapNum(n)} className={K}>{n}</button>)}
      </div>
      {/* Row 1 */}
      <div className="flex gap-1">
        {(isKor?KR1:ER1).map((c,i)=>{
          const ch=isKor?(shift&&KS1[i]?KS1[i]:c):(shift?c.toUpperCase():c);
          return <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(ch):tapEng(c)} className={K}>{ch}</button>;
        })}
      </div>
      {/* Row 2 – indented */}
      <div className="flex gap-1 px-3">
        {(isKor?KR2:ER2).map(c=>(
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(c):tapEng(c)} className={K}>
            {!isKor&&shift?c.toUpperCase():c}
          </button>
        ))}
      </div>
      {/* Row 3: Shift + keys + Backspace */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setShift(v=>!v)}
          className={cn(G,'w-11 flex-none',shift&&'bg-indigo-200 text-indigo-700')}>⇧</button>
        {(isKor?KR3:ER3).map(c=>(
          <button key={c} onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(c):tapEng(c)} className={K}>
            {!isKor&&shift?c.toUpperCase():c}
          </button>
        ))}
        <button {...bspLP} className={cn(G,'w-11 flex-none text-red-500')}>⌫</button>
      </div>
      {/* Row 4: !#1 | 한/영 | , | Space | . | 🔍 */}
      <div className="flex gap-1">
        <button onPointerDown={e=>e.preventDefault()} onClick={toggleLang}
          className={cn(G,'w-16 flex-none text-xs font-black')}>
          {isKor?<span>한<br/>/영</span>:<span>A<br/>/가</span>}
        </button>
        <button onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor(','):tapEng(',')} className={cn(G,'w-10 flex-none')}>,</button>
        <button onPointerDown={e=>e.preventDefault()} onClick={spc} className={cn(G,'flex-1')}>space</button>
        <button onPointerDown={e=>e.preventDefault()} onClick={()=>isKor?tapKor('.'):tapEng('.')} className={cn(G,'w-10 flex-none')}>.</button>
      </div>
    </div>
  );
}

// ── Main StudentInlineKeypad ──────────────────────────────────────────────────
export function StudentInlineKeypad({tabs,defaultTab,onInsert,onCmd,getFieldValue,setFieldValue}:{
  tabs:KeypadTab[]; defaultTab:string;
  onInsert:(l:string)=>void; onCmd:(c:string)=>void;
  getFieldValue:()=>string; setFieldValue:(l:string)=>void;
}){
  const [activeTab,setActiveTab]=useState(defaultTab);
  const isKor=activeTab==='kor';
  const keys=!isKor?(tabs.find(t=>t.id===activeTab)?.keys??[]):[];
  const allTabs=[...tabs,{id:'kor',label:'한글',keys:[]}];
  const bspLP=useLongPress(()=>onCmd('deleteBackward'));

  return(
    <div className="px-3 pb-1 flex-shrink-0">
      <div className="flex gap-0.5 bg-slate-100 p-1 rounded-2xl mb-2">
        {allTabs.map(tab=>(
          <button key={tab.id} onPointerDown={e=>e.preventDefault()} onClick={()=>setActiveTab(tab.id)}
            className={cn('flex-1 py-1.5 rounded-xl text-xs font-black transition-all',
              activeTab===tab.id?'bg-white text-indigo-600 shadow-md':'text-slate-500')}>
            {tab.label}
          </button>
        ))}
      </div>
      {isKor?(
        <KoreanKeyboard key="kor" onInsert={onInsert} onCmd={onCmd} getFieldValue={getFieldValue} setFieldValue={setFieldValue}/>
      ):(
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((key,i)=>(
            <button key={activeTab+i} onPointerDown={e=>e.preventDefault()} onClick={()=>onInsert(key.latex)}
              className="h-10 bg-white border-b-4 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-indigo-50 active:border-b-0 active:translate-y-1 transition-all shadow-sm">
              {key.label}
            </button>
          ))}
          <button {...bspLP} className="h-10 bg-red-50 border-b-4 border-red-200 rounded-xl text-sm font-bold text-red-500 active:border-b-0 active:translate-y-1 transition-all shadow-sm">⌫</button>
          <button onPointerDown={e=>e.preventDefault()} onClick={()=>onCmd('moveToNextPlaceholder')}
            className="h-10 bg-emerald-50 border-b-4 border-emerald-200 rounded-xl text-sm font-bold text-emerald-600 active:border-b-0 active:translate-y-1 transition-all shadow-sm">Tab</button>
        </div>
      )}
    </div>
  );
}

/** @deprecated */
export function KoreanTextRow({onInsert}:{onInsert:(t:string)=>void}){return null;}
