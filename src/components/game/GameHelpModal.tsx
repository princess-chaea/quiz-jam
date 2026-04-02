"use client";
import React from 'react';
import { X, Shield, RefreshCw, Zap, TrendingUp, HelpCircle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface GameHelpModalProps {
  onClose: () => void;
  probabilities?: any;
}

export function GameHelpModal({ onClose, probabilities }: GameHelpModalProps) {
  const prob = probabilities || {
    double: 5,
    swap: 5,
    strike: 5,
    shield: 5,
    cut: 5,
    donate: 5
  };

  const sections = [
    {
      title: "기본 규칙",
      icon: <HelpCircle className="text-indigo-500" />,
      items: [
        { label: "정답 제출", desc: "문제를 풀고 '정답 제출하기' 또는 엔터를 누르세요." },
        { label: "수식 키보드", desc: "수식 입력 시 화면의 자판 아이콘을 눌러 활성화하세요." },
        { label: "입력창 새로고침", desc: "수식이 잘 안 써지거나 입력창이 이상할 때 '새로고침' 버튼을 누르세요." }
      ]
    },
    {
      title: "아이템 효과",
      icon: <Zap className="text-yellow-500" />,
      items: [
        { icon: "⚡", label: "점수 2배", desc: "해당 문제 정답 시 획득 점수가 2배가 됩니다." },
        { icon: "🔄", label: "점수 교체", desc: "원하는 학생과 내 점수를 바꿀 수 있습니다." },
        { icon: "🔥", label: "스트라이크", desc: "다음 문제 정답 시 점수가 2배가 됩니다." },
        { icon: "🛡️", label: "방어권", desc: "교체, 삭감, 기부 공격을 1회 방어합니다." },
        { icon: "✂️", label: "점수 깎기", desc: "오답일 경우 해당 문제의 배점만큼 점수가 삭감됩니다." },
        { icon: "🎁", label: "점수 기부", desc: "오답일 경우 정답자(최대 5명)에게 10점씩 기부합니다." }
      ]
    },
    {
      title: "보너스 점수",
      icon: <TrendingUp className="text-emerald-500" />,
      items: [
        { icon: "🚀", label: "빠른 정답 보너스", desc: "남들보다 빠르게 정답을 제출하면 더 높은 점수를 받습니다." },
        { icon: "📈", label: "연속 정답 (Streak)", desc: "2회 이상 연속 정답 시 콤보 가산점이 부여됩니다." }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border-8 border-indigo-100 italic-none animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <HelpCircle size={24} />
            </div>
            <h2 className="text-2xl font-black font-jua">퀴즈 게임 가이드</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-8">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2">
                {section.icon}
                <h3 className="text-xl font-black text-slate-800">{section.title}</h3>
              </div>
              <div className="grid gap-3">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="bg-slate-50 p-4 rounded-2xl flex gap-4 items-start border border-slate-100 transition-all hover:bg-indigo-50/50 hover:border-indigo-100">
                    {item.icon ? (
                      <span className="text-2xl shrink-0">{item.icon}</span>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2.5 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900 mb-0.5">{item.label}</div>
                      <div className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          ))}

          {/* Probabilities / Luck Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2">
              <Zap className="text-amber-500" />
              <h3 className="text-xl font-black text-slate-800">이번 판의 아이템 행운</h3>
            </div>
            <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-200 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
               <div className="flex flex-col items-center">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">점수 2배</span>
                  <span className="text-2xl font-black text-amber-900">{prob.double || 0}%</span>
               </div>
               <div className="flex flex-col items-center border-l border-amber-200">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">점수 교체</span>
                  <span className="text-2xl font-black text-amber-900">{prob.swap || 0}%</span>
               </div>
               <div className="flex flex-col items-center border-l border-amber-200 md:border-l-0 lg:border-l">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">스트라이크</span>
                  <span className="text-2xl font-black text-amber-900">{prob.strike || 0}%</span>
               </div>
               <div className="flex flex-col items-center md:border-l border-amber-200">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">방어권</span>
                  <span className="text-2xl font-black text-amber-900">{prob.shield || 0}%</span>
               </div>
               <div className="flex flex-col items-center border-l border-amber-200">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">점수 삭감</span>
                  <span className="text-2xl font-black text-amber-900">{prob.cut || 0}%</span>
               </div>
               <div className="flex flex-col items-center border-l border-amber-200">
                  <span className="text-xs font-black text-amber-600 mb-1 uppercase">점수 기부</span>
                  <span className="text-2xl font-black text-amber-900">{prob.donate || 0}%</span>
               </div>
            </div>
          </div>
          
          <div className="bg-indigo-50 p-6 rounded-[2rem] border-2 border-dashed border-indigo-200 text-center">
            <p className="text-indigo-600 font-bold italic">" 친구들과 함께 즐겁게 퀴즈를 풀며 실력을 키워보세요! "</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <Button onClick={onClose} className="w-full bg-indigo-600 h-14 rounded-2xl text-xl font-black shadow-lg shadow-indigo-200">확인했습니다!</Button>
        </div>
      </div>
    </div>
  );
}
