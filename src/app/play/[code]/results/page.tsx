"use client";

import { useGame, Player, Game } from "@/hooks/useGame";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Trophy, Medal, Star, ChevronLeft, ChevronRight, X as CloseIcon } from "lucide-react";
import confetti from "canvas-confetti";
import React, { useEffect, Suspense, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface RankingItemProps {
  rank: number;
  nickname: string;
  score: number;
  isMe: boolean;
}

function RankingItem({ rank, nickname, score, isMe }: RankingItemProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-xl border transition-all",
      isMe ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "bg-slate-50 border-slate-100"
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
          rank === 1 ? "bg-yellow-400 text-white" : 
          rank === 2 ? "bg-slate-300 text-white" : 
          rank === 3 ? "bg-orange-300 text-white" : 
          "bg-slate-200 text-slate-500"
        )}>{rank}</span>
        <span className="font-bold text-sm text-slate-700 truncate max-w-[100px]">{nickname} {isMe && "(나)"}</span>
      </div>
      <span className="font-black text-indigo-600 text-sm">{score.toLocaleString()}</span>
    </div>
  );
}

function ResultsContent() {
  const params = useParams();
  const code = params?.code as string;
  const searchParams = useSearchParams();
  const name = searchParams?.get("name") || "";
  const router = useRouter();
  
  const { game, players, loading } = useGame(code);
  const [showScoreTab, setShowScoreTab] = useState(false);
  const [rankingTab, setRankingTab] = useState<'individual' | 'team'>('individual');
  const sidebarRef = useRef<HTMLDivElement>(null);

  const me = useMemo(() => players.find(p => p.nickname === name), [players, name]);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score || 0) - (a.score || 0)), [players]);
  
  const myRank = useMemo(() => {
    if (!name || !me) return 0;
    const myScore = me.score || 0;
    const firstIdx = sortedPlayers.findIndex(p => p.score === myScore);
    return firstIdx + 1;
  }, [name, me, sortedPlayers]);

  const teamRankings = useMemo(() => {
    if (!game?.options?.isTeamMode) return [];
    const teamScores: Record<string, number> = {};
    players.forEach(p => {
      const t = p.team || "팀 없음";
      teamScores[t] = (teamScores[t] || 0) + (p.score || 0);
    });
    return Object.entries(teamScores)
      .map(([teamName, score]) => ({ teamName, score }))
      .sort((a, b) => b.score - a.score);
  }, [game?.options?.isTeamMode, players]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showScoreTab && sidebarRef.current && !sidebarRef.current.contains(target)) {
        setShowScoreTab(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showScoreTab]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <Trophy size={48} className="text-indigo-200" />
        <div className="text-2xl text-indigo-400">결과 집계 중...</div>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 font-jua p-6">
      <div className="text-xl text-red-600">게임을 찾을 수 없습니다.</div>
    </div>
  );

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border-b-4 border-indigo-100 max-w-sm">
          <Medal size={48} className="text-indigo-200 mb-4 mx-auto" />
          <h2 className="text-xl mb-2 text-gray-700">참여 정보를 확인하고 있어요</h2>
          <p className="text-gray-400 text-sm">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative" onClick={() => { if(showScoreTab) setShowScoreTab(false); }}>
        
        {/* Floating Leaderboard Sidebar */}
        <div 
          ref={sidebarRef}
          className={cn(
            "fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 flex items-center",
            showScoreTab ? "translate-x-0" : "translate-x-[calc(100%-40px)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
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

            {game?.options?.isTeamMode && (
              <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl shrink-0">
                <button onClick={() => setRankingTab('individual')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'individual' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>개인별</button>
                <button onClick={() => setRankingTab('team')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>팀별</button>
              </div>
            )}

            {/* Detailed Team Stats for Results */}
            {game?.options?.isTeamMode && me?.team && (
              <div className="mb-4 p-3 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100/50 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-indigo-400">우리팀 현황</span>
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-full">
                    {me.team === 'RED' ? '빨강팀' : me.team === 'BLUE' ? '파랑팀' : me.team === 'GREEN' ? '초록팀' : me.team === 'YELLOW' ? '노랑팀' : me.team}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {players.filter(p => p.team === me.team).map(member => (
                    <div key={member.id} className="flex justify-between items-center bg-white/60 p-1.5 rounded-lg border border-indigo-50 text-left">
                      <span className={cn("text-[11px] font-bold truncate pr-1 flex-1", member.nickname === name ? "text-indigo-600" : "text-slate-600")}>
                        {member.nickname === name && "👤 "}{member.nickname}
                      </span>
                      <span className="text-[11px] font-black text-slate-500 tabular-nums">{(member.score || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between items-center border-t border-indigo-100 pt-2 pb-0.5">
                  <span className="text-[10px] font-black text-indigo-800 uppercase tracking-tighter">우리팀 합계</span>
                  <span className="text-sm font-black text-indigo-600 tabular-nums">
                    {players.filter(p => p.team === me.team).reduce((acc, curr) => acc + (curr.score || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {rankingTab === 'team' && game?.options?.isTeamMode ? (
                teamRankings.map((tr, i) => (
                  <div key={tr.teamName} className={cn("flex items-center justify-between p-2 rounded-xl border bg-slate-50 border-slate-100", tr.teamName === me?.team ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black", i===0 ? "bg-yellow-400 text-white" : "bg-slate-200 text-slate-500")}>{i+1}</span>
                      <span className="font-bold text-sm text-slate-700 truncate max-w-[100px]">{tr.teamName === 'RED' ? '빨강팀' : tr.teamName === 'BLUE' ? '파랑팀' : tr.teamName === 'GREEN' ? '초록팀' : tr.teamName === 'YELLOW' ? '노랑팀' : tr.teamName} {tr.teamName === me.team && "(우리팀)"}</span>
                    </div>
                    <span className="font-black text-indigo-600 text-sm">{tr.score.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                sortedPlayers.map((p, i) => {
                  let rank = i + 1;
                  if (i > 0 && p.score === sortedPlayers[i-1].score) {
                    const firstIdx = sortedPlayers.findIndex(p2 => p2.score === p.score);
                    rank = firstIdx + 1;
                  }
                  return <RankingItem key={p.id} rank={rank} nickname={p.nickname} score={p.score || 0} isMe={p.nickname === name} />;
                })
              )}
            </div>
          </div>
        </div>

        <div className="max-w-md w-full animate-pop">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-indigo-200">
            <div className="bg-indigo-600 p-10 flex flex-col items-center text-white relative">
              <img src="/logo.png" className="w-16 h-16 object-contain mb-4 animate-pop shadow-md rounded-2xl bg-white/10 p-2" alt="Quiz Jam Logo" />
              <div className="mb-2">
                <Trophy size={64} className="text-yellow-400 drop-shadow-lg" />
              </div>
              <h1 className="text-3xl font-jua">게임 완료</h1>
              <p className="opacity-80 font-bold">{name} 학생, 수고했어요!</p>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex flex-col items-center">
                <div className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">최종 점수</div>
                <div className="text-7xl font-black text-indigo-600 drop-shadow-sm">{me?.score || 0}</div>
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
    </div>
  );
}

export default function StudentResults() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold font-jua text-indigo-600 text-2xl">페이지를 준비 중입니다...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
