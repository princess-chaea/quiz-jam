import React from "react";

export function Footer() {
  return (
    <footer className="w-full bg-slate-900 border-t border-slate-800 py-8 lg:py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center gap-4">
        <div className="text-slate-400 text-sm font-medium text-center">
          <p className="mb-2">저작권 표시(교육적 무료 배포)</p>
          <p>
            제작 <span className="text-indigo-400 font-bold">하주초등학교 교사 이성근</span> | 문의 <a href="mailto:dltjdrms320@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">dltjdrms320@gmail.com</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
