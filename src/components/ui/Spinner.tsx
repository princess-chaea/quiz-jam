import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  label?: string;
  fullScreen?: boolean;
}

export function Spinner({ label = "로딩 중...", fullScreen = false }: SpinnerProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={24} />
      </div>
      <p className="font-jua text-indigo-800 text-lg tracking-wide animate-pulse">
        {label}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/80 backdrop-blur-sm fixed inset-0 z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full py-20 flex items-center justify-center">
      {content}
    </div>
  );
}
