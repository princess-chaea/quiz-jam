import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-6 border-t border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center">
          <img src="/logo.png" alt="클래스 퀴즈 잼!" className="h-10 object-contain" />
        </div>
        <div className="flex flex-col items-center gap-1 text-slate-400 text-sm font-bold text-center">
          <p>© 2026 퀴즈잼 • Created for Inspired Education</p>
          <p className="text-xs font-medium">제작 및 문의 : 하주초등학교 이성근 <a href="mailto:dltjdrms320@gmail.com" className="hover:text-indigo-500 transition-colors">dltjdrms320@gmail.com</a></p>
        </div>
        <div className="flex gap-6 text-slate-400 font-bold text-sm">
          <Link href="/terms" className="hover:text-indigo-600 transition-colors">이용약관</Link>
          <Link href="/privacy" className="hover:text-indigo-600 transition-colors">개인정보처리방침</Link>
        </div>
      </div>
    </footer>
  );
}
