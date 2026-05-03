
"use client";
import React, { useState, useRef } from 'react';
import { SegmentedInput } from '@/components/game/SegmentedInput';

export default function KeyboardTest() {
  const [val1, setVal1] = useState("");
  const [val2, setVal2] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    if (logRef.current) {
      logRef.current.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${msg}</div>`;
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold">Keyboard Focus Test</h1>
      
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-bold mb-4">1. SegmentedInput Test</h2>
        <p className="text-sm text-gray-500 mb-2">Try clicking the boxes below. On mobile, the keyboard should appear.</p>
        <SegmentedInput 
          length={5} 
          value={val1} 
          onChange={(v) => {
            setVal1(v);
            addLog(`SegmentedInput changed: ${v}`);
          }} 
        />
        <div className="mt-4">Value: {val1}</div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-bold mb-4">Log</h2>
        <div 
          ref={logRef}
          className="h-40 overflow-y-auto bg-black text-green-400 p-2 font-mono text-xs rounded"
        >
          <div>Ready...</div>
        </div>
      </div>

      <button 
        className="p-4 bg-blue-500 text-white rounded-lg"
        onClick={() => {
          const input = document.querySelector('input[type="text"]');
          if (input) {
            (input as HTMLElement).focus();
            addLog("Programmatic focus triggered on hidden input");
          }
        }}
      >
        Trigger Programmatic Focus (Should fail to show keyboard on mobile)
      </button>
    </div>
  );
}
