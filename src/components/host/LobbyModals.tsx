"use client";

import { useState } from "react";
import { X, UserMinus, ShieldAlert, UserCog, Users, Settings, Zap, RotateCcw, Shield, Gift, Scissors, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface KickConfirmModalProps {
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KickConfirmModal({ playerName, onConfirm, onCancel }: KickConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-pop">
        <div className="bg-red-100 text-red-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <UserMinus size={40} />
        </div>
        <h3 className="text-2xl font-jua text-gray-800 mb-2">{playerName} 학생을 <br/> 강퇴할까요?</h3>
        <p className="text-gray-500 font-bold mb-8">다시 입장하기 어려울 수 있습니다.</p>
        
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1 py-4" onClick={onCancel}>취소</Button>
          <Button variant="danger" className="flex-1 py-4 shadow-lg shadow-red-100" onClick={onConfirm}>강퇴하기</Button>
        </div>
      </div>
    </div>
  );
}

interface ChangeTeamModalProps {
  player: { nickname: string, id: string, team: string | null };
  teamCount: number;
  onConfirm: (team: 'RED' | 'BLUE' | 'GREEN' | 'YELLOW') => void;
  onCancel: () => void;
}

export function ChangeTeamModal({ player, teamCount, onConfirm, onCancel }: ChangeTeamModalProps) {
  const teams: ('RED' | 'BLUE' | 'GREEN' | 'YELLOW')[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
  const activeTeams = teams.slice(0, teamCount);
  
  const teamNames = {
    RED: '빨강팀',
    BLUE: '파랑팀',
    GREEN: '초록팀',
    YELLOW: '노랑팀'
  };

  const teamColors = {
    RED: 'bg-red-500',
    BLUE: 'bg-blue-500',
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-400'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-pop">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCog size={24} />
            <h3 className="text-xl font-jua">팀 변경: {player.nickname}</h3>
          </div>
          <button onClick={onCancel} className="hover:bg-white/20 p-1 rounded-lg">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8">
          <p className="text-gray-500 font-bold mb-6 text-center">어떤 팀으로 이동할까요?</p>
          <div className="grid grid-cols-2 gap-4">
            {activeTeams.map(team => (
              <button
                key={team}
                onClick={() => onConfirm(team)}
                className={`p-4 rounded-2xl border-4 text-white font-black text-lg transition-transform active:scale-95 ${teamColors[team]} ${player.team === team ? 'ring-4 ring-indigo-200 border-white' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'}`}
              >
                {teamNames[team]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EventSettingsModalProps {
  probabilities: {
    double: number;
    swap: number;
    strike: number;
    shield: number;
    cut: number;
    donate: number;
  };
  onSave: (probs: any) => void;
  onCancel: () => void;
}

export function EventSettingsModal({ probabilities, onSave, onCancel }: EventSettingsModalProps) {
  const [localProbs, setLocalProbs] = useState(probabilities);

  const icons = {
    double: <Zap className="text-yellow-400" size={20} />,
    swap: <RotateCcw className="text-indigo-400" size={20} />,
    strike: <Zap className="text-blue-400" size={20} />,
    shield: <Shield className="text-cyan-400" size={20} />,
    cut: <Scissors className="text-red-400" size={20} />,
    donate: <Gift className="text-green-400" size={20} />,
  };

  const labels = {
    double: '점수 2배',
    swap: '점수 교체',
    strike: '스트라이크',
    shield: '방어권',
    cut: '점수 깎기',
    donate: '점수 기부',
  };
  
  const descriptions = {
    double: '정답 시 획득 점수 2배',
    swap: '원하는 학생과 점수 바꾸기',
    strike: '다음 정답 시 x2',
    shield: '교체, 삭감, 기부 1회 방어',
    cut: '오답일 경우 배점만큼 삭감',
    donate: '오답일 경우 정답자(최대 5명)에게 10점씩 기부',
  };
  const colors = {
    double: 'bg-yellow-50 border-yellow-200',
    swap: 'bg-indigo-50 border-indigo-200',
    strike: 'bg-blue-50 border-blue-200',
    shield: 'bg-cyan-50 border-cyan-200',
    cut: 'bg-red-50 border-red-200',
    donate: 'bg-green-50 border-green-200',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-pop">
        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Settings size={32} className="animate-spin-slow" />
            <div>
              <h3 className="text-2xl font-jua">발동 확률 설정</h3>
              <p className="text-indigo-100 text-sm font-bold">아이템별 나타날 확률을 설정하세요 (0-100%)</p>
            </div>
          </div>
          <button onClick={onCancel} className="hover:bg-white/20 p-2 rounded-2xl transition-colors">
            <X size={28} />
          </button>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {Object.keys(localProbs).map((key) => {
              const k = key as keyof typeof localProbs;
              return (
                <div key={k} className={cn("p-4 rounded-3xl border-2 flex flex-col gap-3", colors[k])}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       {icons[k]}
                       <div className="flex flex-col">
                         <span className="font-black text-gray-700">{labels[k]}</span>
                         <span className="text-[10px] text-gray-400 mt-1">{descriptions[k as keyof typeof descriptions]}</span>
                       </div>
                    </div>
                    <div className="bg-white px-3 py-1 rounded-full font-black text-indigo-600 shadow-sm border border-indigo-100">
                      {localProbs[k]}%
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={localProbs[k]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalProbs((prev: any) => ({ ...prev, [k]: parseInt(e.target.value) }))}
                    className="w-full accent-indigo-600 h-2 bg-white rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-4">
            <Button variant="ghost" className="flex-1 py-6 rounded-2xl text-lg font-bold" onClick={onCancel}>
              취소
            </Button>
            <Button className="flex-1 py-6 rounded-2xl text-lg font-black shadow-xl shadow-indigo-100" onClick={() => onSave(localProbs)}>
              설정 저장하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DefaultConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DefaultConfirmModal({ onConfirm, onCancel }: DefaultConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 text-center animate-pop">
        <div className="bg-yellow-100 text-yellow-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <AlertCircle size={48} />
        </div>
        <h3 className="text-2xl font-jua text-gray-800 mb-4 tracking-tighter">확률을 설정할까요?</h3>
        <div className="bg-slate-50 p-4 rounded-2xl mb-8 border-2 border-slate-100">
           <p className="text-gray-500 font-bold mb-1">모든 효과 확률을</p>
           <p className="text-indigo-600 font-black text-2xl">기본값 5%</p>
           <p className="text-gray-500 font-bold mt-1">로 시작할까요?</p>
        </div>
        
        <div className="flex flex-col gap-3">
          <Button className="w-full py-6 rounded-2xl text-xl font-black shadow-xl shadow-indigo-100 bg-indigo-600" onClick={onConfirm}>
            네, 그렇게 할게요!
          </Button>
          <Button variant="ghost" className="w-full py-4 rounded-2xl font-bold" onClick={onCancel}>
            아뇨, 직접 설정할게요
          </Button>
        </div>
      </div>
    </div>
  );
}

