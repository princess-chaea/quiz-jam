import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-20 border-t border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center">
          <img src="/logo.png" alt="클래스 퀴즈 잼!" className="h-10 object-contain" />
        </div>
        <p className="text-slate-400 text-sm font-bold">
          © 2026 퀴즈잼 • Created for Inspired Education
        </p>
        <div className="flex gap-6 text-slate-400 font-bold text-sm">
          <Link href="/terms" className="hover:text-indigo-600 transition-colors">이용약관</Link>
          <Link href="/privacy" className="hover:text-indigo-600 transition-colors">개인정보처리방침</Link>
        </div>
      </div>
    </footer>
  );
}
