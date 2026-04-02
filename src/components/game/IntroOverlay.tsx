"use client";

import React, { useState, useEffect } from 'react';
import { Keyboard, RefreshCw, Zap, Star, X } from 'lucide-react';
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <Keyboard className="text-white" size={24} />
            </div>
            <h3 className="font-black text-xl mb-2">수식 키보드</h3>
            <p className="text-indigo-100 font-bold text-sm leading-relaxed">
              분수나 거듭제곱 등 복잡한 수식은 전용 키보드를 사용하세요!
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCw className="text-white" size={24} />
            </div>
            <h3 className="font-black text-xl mb-2">입력 새로고침</h3>
            <p className="text-indigo-100 font-bold text-sm leading-relaxed">
              키보드가 안 눌리거나 이상하면 새로고침 버튼을 꾹! 눌러주세요.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="text-white" size={24} />
            </div>
            <h3 className="font-black text-xl mb-2">특별한 효과</h3>
            <p className="text-indigo-100 font-bold text-sm leading-relaxed">
              깜짝 퀴즈 보너스나 점수 바꾸기로 역전의 기회를 잡으세요!
            </p>
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
