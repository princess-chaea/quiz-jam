"use client";

import React, { useState, useEffect } from 'react';
import { Keyboard, RefreshCw, Zap, Star, X, Shield, Gift } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface IntroOverlayProps {
  onClose: () => void;
  isTeacher?: boolean;
}

export function IntroOverlay({ onClose, isTeacher = false }: IntroOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const autoHide = setTimeout(() => {
      handleClose();
    }, 5500);

    return () => {
      clearInterval(timer);
      clearTimeout(autoHide);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-indigo-600 flex flex-col items-center justify-center animate-in zoom-in-95 transition-all p-8 text-center text-white">
      <div className="max-w-2xl w-full space-y-8 animate-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-6 animate-bounce mx-auto backdrop-blur-md border border-white/20">
          <Star size={48} className="text-yellow-300 fill-yellow-300" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
          잠깐! 게임 꿀팁을 확인하세요 💡
        </h1>
        
        <p className="text-indigo-100 text-lg md:text-xl font-bold mb-12 opacity-90">
          {isTeacher 
            ? "학생들에게 설명되는 게임 규칙입니다." 
            : "더 재미있고 원활한 퀴즈 참여를 위한 안내입니다."}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-left">
          {/* Row 1 */}
          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-400 rounded-xl text-yellow-900 shrink-0">
                <Zap size={20} className="fill-current" />
              </div>
              <div className="font-black text-white text-base">점수 2배</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">정답 시 획득 점수가<br/>2배로 껑충!</div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-400 rounded-xl text-indigo-900 shrink-0">
                <RefreshCw size={20} />
              </div>
              <div className="font-black text-white text-base">점수 교체</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">원하는 친구와<br/>점수를 바꿔요!</div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-400 rounded-xl text-orange-900 shrink-0">
                <Star size={20} className="fill-current" />
              </div>
              <div className="font-black text-white text-base">스트라이크</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">다음 정답 시<br/>점수가 2배!</div>
          </div>

          {/* Row 2 */}
          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-400 rounded-xl text-blue-900 shrink-0">
                <Shield size={20} />
              </div>
              <div className="font-black text-white text-base">방어권</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">공격을 1회<br/>철벽 방어!</div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-400 rounded-xl text-red-900 shrink-0">
                <X size={20} strokeWidth={4} />
              </div>
              <div className="font-black text-white text-base">점수 삭감</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">오답일 경우<br/>배점만큼 삭감!</div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex flex-col gap-2 hover:bg-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-400 rounded-xl text-emerald-900 shrink-0">
                <Gift size={20} />
              </div>
              <div className="font-black text-white text-base">점수 기부</div>
            </div>
            <div className="text-white/60 text-xs font-bold leading-tight">오답 시 정답자에게<br/>점수를 줘요!</div>
          </div>
        </div>

        <div className="pt-8 flex flex-col items-center gap-4">
          <button 
             onClick={handleClose}
             className="bg-white text-indigo-600 px-12 py-4 rounded-[2rem] font-black text-xl shadow-2xl hover:scale-105 transition-all"
          >
            준비 완료! ({countdown})
          </button>
        </div>
      </div>
    </div>
  );
}
