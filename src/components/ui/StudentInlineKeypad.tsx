"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export type KeypadTab = {
  id: string;
  label: string;
  keys: { label: string; latex: string }[];
};

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
  const keys = tabs.find(t => t.id === activeTab)?.keys ?? [];

  return (
    <div className="px-3 pb-1 flex-shrink-0">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-2">
        {tabs.map(tab => (
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

      {/* Key grid */}
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
        >
          ⌫
        </button>
        {/* Tab – move to next placeholder */}
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onCmd("moveToNextPlaceholder")}
          className="h-10 bg-emerald-50 border-b-4 border-emerald-200 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
        >
          Tab
        </button>
      </div>
    </div>
  );
}

/** Separate text input row for Korean (and other non-math text) input.
 *  Calls onInsert with \text{...} wrapping so MathLive renders it correctly. */
export function KoreanTextRow({ onInsert }: { onInsert: (text: string) => void }) {
  const [text, setText] = useState("");

  const handleInsert = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onInsert(trimmed);
    setText("");
  };

  return (
    <div className="flex items-center gap-2 px-3 pb-2 flex-shrink-0">
      <span className="text-xs font-bold text-slate-400 whitespace-nowrap">한글</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInsert(); } }}
        placeholder="텍스트 입력 후 삽입"
        className="flex-1 h-10 px-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-slate-50"
      />
      <button
        onPointerDown={(e) => e.preventDefault()}
        onClick={handleInsert}
        className="h-10 px-4 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all flex-shrink-0"
      >
        삽입
      </button>
    </div>
  );
}
