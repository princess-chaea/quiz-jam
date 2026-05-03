"use client";
import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = {
  id: string;
  label: string;
  keys: { label: string; latex: string }[];
};

/** Main student inline keypad with 123 / 초등 / 중등 / 고등 / 한글 tabs.
 *  The 한글 tab shows a native text input – tapping it on mobile raises the OS keyboard. */
export function StudentInlineKeypad({
  tabs,
  defaultTab,
  onInsert,
  onCmd,
}: {
  tabs: KeypadTab[];
  defaultTab: string;
  onInsert: (latex: string) => void;
  onCmd: (name: string) => void;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [koreanText, setKoreanText] = useState("");
  const koreanInputRef = useRef<HTMLInputElement>(null);

  const isKorean = activeTab === "kor";
  const keys = !isKorean ? (tabs.find(t => t.id === activeTab)?.keys ?? []) : [];

  const insertKorean = () => {
    const trimmed = koreanText.trim();
    if (!trimmed) return;
    onInsert(`\\text{${trimmed}}`);
    setKoreanText("");
    koreanInputRef.current?.focus();
  };

  // All tabs + 한글 tab appended
  const allTabs = [...tabs, { id: "kor", label: "한글", keys: [] }];

  return (
    <div className="px-3 pb-1 flex-shrink-0">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-2">
        {allTabs.map(tab => (
          <button
            key={tab.id}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-black transition-all",
              activeTab === tab.id
                ? "bg-white text-indigo-600 shadow-md"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isKorean ? (
        /* Korean input mode – uses native OS keyboard */
        <div className="flex flex-col gap-2 py-1">
          <p className="text-xs text-slate-400 text-center">
            한글 / 텍스트를 입력하고 <strong>삽입</strong>을 누르세요
          </p>
          <div className="flex gap-2">
            <input
              ref={koreanInputRef}
              type="text"
              value={koreanText}
              onChange={(e) => setKoreanText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); insertKorean(); }
              }}
              placeholder="예) 킬로미터, cm, 원..."
              autoFocus
              className="flex-1 h-11 px-4 rounded-2xl border-2 border-indigo-200 text-base focus:outline-none focus:border-indigo-400 bg-slate-50"
            />
            <button
              onPointerDown={(e) => e.preventDefault()}
              onClick={insertKorean}
              className="h-11 px-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex-shrink-0"
            >
              삽입
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["cm", "km", "m", "g", "kg", "mL", "L", "원", "개", "명", "마리", "번"].map(q => (
              <button
                key={q}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onInsert(`\\text{${q}}`)}
                className="h-9 px-3 bg-white border-b-4 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-indigo-50 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Math key grid */
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((key, i) => (
            <button
              key={activeTab + i}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onInsert(key.latex)}
              className="h-10 bg-white border-b-4 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-indigo-50 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
            >
              {key.label}
            </button>
          ))}
          {/* Backspace */}
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onCmd("deleteBackward")}
            className="h-10 bg-red-50 border-b-4 border-red-200 rounded-xl text-sm font-bold text-red-500 hover:bg-red-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
          >⌫</button>
          {/* Tab */}
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onCmd("moveToNextPlaceholder")}
            className="h-10 bg-emerald-50 border-b-4 border-emerald-200 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
          >Tab</button>
        </div>
      )}
    </div>
  );
}

/** @deprecated – Korean input is now part of StudentInlineKeypad's 한글 tab */
export function KoreanTextRow({ onInsert }: { onInsert: (text: string) => void }) {
  return null;
}
