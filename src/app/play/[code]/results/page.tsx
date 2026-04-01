"use client";

import { useGame } from "@/hooks/useGame";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Trophy, Home, Medal, Star, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, Suspense, useState } from "react";
import { cn } from "@/lib/utils";

function ResultsContent() {
  const { code } = useParams();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const router = useRouter();
  
  const { game, players, loading } = useGame(code as string);

  const [showScoreTab, setShowScoreTab] = useState(false);
  const [rankingTab, setRankingTab] = useState<'individual' | 'team'>('individual');

  const me = players.find(p => p.nickname === name);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Competition Ranking (1224) logic for myRank
  const myRank = (() => {
    if (!name) return 0;
    const myScore = me?.score || 0;
    const firstIdx = sortedPlayers.findIndex(p => p.score === myScore);
    return firstIdx + 1;
  })();

  useEffect(() => {
    if (!loading && players.length > 0 && myRank > 0 && myRank <= 3) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#4f46e5", "#10b981", "#fbbf24"]
      });
    }
  }, [loading, players.length, myRank]);

  // --- RENDERING ---
  
  let content = null;

  if (loading) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy size={48} className="text-indigo-200" />
          <div className="text-2xl text-indigo-400">결과 집계 중...</div>
        </div>
      </div>
    );
  } else if (!me) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border-b-4 border-indigo-100 max-w-sm">
          <Medal size={48} className="text-indigo-200 mb-4 mx-auto" />
          <h2 className="text-xl mb-2 text-gray-700">참여 정보를 확인하고 있어요</h2>
          <p className="text-gray-400 text-sm">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        
        {/* Floating Leaderboard Sidebar (Consistent with GameDisplay) */}
        <div className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 flex items-center",
          showScoreTab ? "translate-x-0" : "translate-x-[calc(100%-40px)]"
        )}>
          <button onClick={() => setShowScoreTab(!showScoreTab)} className="w-10 h-24 bg-indigo-600 text-white rounded-l-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors">
            <Trophy size={18} />
            <span className="text-[8px] font-black [writing-mode:vertical-lr]">RANKING</span>
            {showScoreTab ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <div className="w-64 md:w-72 h-[60vh] bg-white shadow-2xl border-2 border-indigo-100 rounded-l-2xl p-4 overflow-y-auto custom-scrollbar flex flex-col text-left">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h3 className="font-black text-indigo-900">최종 순위</h3>
              <span className="text-[10px] text-indigo-400 font-bold">집계완료</span>
            </div>

            {game.is_team_mode && (
              <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl shrink-0">
                <button onClick={() => setRankingTab('individual')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'individual' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>개인별</button>
                <button onClick={() => setRankingTab('team')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>팀별</button>
              </div>
            )}

            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {(() => {
                if (rankingTab === 'team' && game.is_team_mode) {
                  const teamScores: Record<string, number> = {};
                  players.forEach(p => {
                    const t = p.team || "팀 없음";
                    teamScores[t] = (teamScores[t] || 0) + (p.score || 0);
                  });
                  const sortedTeams = Object.entries(teamScores).sort((a,b) => b[1] - a[1]);
                  return sortedTeams.map(([teamName, score], i) => (
                    <div key={teamName} className={cn("flex items-center justify-between p-2 rounded-xl border bg-slate-50 border-slate-100", teamName === me.team ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "")}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black", i===0 ? "bg-yellow-400 text-white" : "bg-slate-200 text-slate-500")}>{i+1}</span>
                        <span className="font-bold text-sm text-slate-700 truncate max-w-[100px]">{teamName} {teamName === me.team && "(우리 팀)"}</span>
                      </div>
                      <span className="font-black text-indigo-600 text-sm">{score.toLocaleString()}</span>
                    </div>
                  ));
                }

                return sortedPlayers.map((p, i) => {
                  let rank = i + 1;
                  if (i > 0 && p.score === sortedPlayers[i-1].score) {
                    const firstIdx = sortedPlayers.findIndex(player => player.score === p.score);
                    rank = firstIdx + 1;
                  }
                  return (
                    <div key={p.id} className={cn("flex items-center justify-between p-2 rounded-xl border transition-all", p.nickname === name ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "bg-slate-50 border-slate-100")}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black", rank===1 ? "bg-yellow-400 text-white" : rank===2 ? "bg-slate-300 text-white" : rank===3 ? "bg-orange-300 text-white" : "bg-slate-200 text-slate-500")}>{rank}</span>
                        <span className="font-bold text-sm text-slate-700 truncate max-w-[100px]">{p.nickname} {p.nickname === name && "(나)"}</span>
                      </div>
                      <span className="font-black text-indigo-600 text-sm">{p.score.toLocaleString()}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <div className="max-w-md w-full animate-pop">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-indigo-200">
            <div className="bg-indigo-600 p-10 flex flex-col items-center text-white relative">
              <img src="/logo.png" className="w-16 h-16 object-contain mb-4 animate-pop shadow-md rounded-2xl bg-white/10 p-2" alt="Quiz Jam Logo" />
              <div className="relative mb-2">
                <Trophy size={64} className="text-yellow-400 drop-shadow-lg" />
                <Star size={24} className="absolute -top-2 -right-2 text-yellow-200 animate-pulse" />
              </div>
              <h1 className="text-3xl font-jua">게임 완료</h1>
              <p className="opacity-80 font-bold">{name} 학생, 수고했어요!</p>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex flex-col items-center">
                <div className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">최종 점수</div>
                <div className="text-7xl font-black text-indigo-600 drop-shadow-sm">{me.score}</div>
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 text-left">
                  <div className="bg-yellow-100 text-yellow-600 p-3 rounded-xl">
                    <Medal size={32} />
                  </div>
                  <div>
                     <div className="text-xs font-black text-gray-400 uppercase">순위</div>
                     <div className="text-2xl font-black text-gray-800">{myRank === 0 ? '-' : myRank}위 / {players.length}명</div>
                  </div>
                </div>
                {myRank === 1 && (
                  <div className="bg-indigo-600 text-white px-4 py-1 rounded-full font-black text-xs animate-pulse">
                    1등
                  </div>
                )}
              </div>

              <p className="text-gray-500 font-bold leading-relaxed">
                정말 잘했어요! <br/>
                선생님과 친구들과 함께한 퀴즈 게임이 즐거웠나요?
              </p>

              <Button 
                variant="primary" 
                size="xl" 
                className="w-full py-6 rounded-2xl text-xl font-black shadow-xl"
                onClick={() => router.push("/join")}
              >
                홈으로 이동
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 text-indigo-300 font-bold text-sm">
          © 2026 퀴즈잼 • 실시간 퀴즈 앱
        </div>
      </div>
    );
  }

  return content;
}

export default function StudentResults() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold font-jua text-indigo-600 text-2xl">페이지를 준비 중입니다...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
