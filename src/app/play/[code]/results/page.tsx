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
  avatar_id: number;
}

function RankingItem({ rank, nickname, score, isMe, avatar_id }: RankingItemProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-xl border transition-all group",
      isMe ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "bg-slate-50 border-slate-100"
    )}>
      <div className="flex items-center gap-3">
        <span className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
          rank === 1 ? "bg-yellow-400 text-white" : 
          rank === 2 ? "bg-slate-300 text-white" : 
          rank === 3 ? "bg-orange-300 text-white" : 
          "bg-slate-200 text-slate-500"
        )}>{rank}</span>
        
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 shadow-sm">
          <img 
            src={`/avatars/avatar_${avatar_id || 1}.png`} 
            className="w-full h-full object-cover" 
            alt="char"
            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
          />
        </div>

        <span className="font-bold text-sm text-slate-700 truncate max-w-[100px]">{nickname} {isMe && "(나)"}</span>
      </div>
      <span className="font-black text-indigo-600 text-sm shrink-0">{score.toLocaleString()}</span>
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
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-start md:justify-center p-4 md:p-6 text-center overflow-x-hidden relative" onClick={() => { if(showScoreTab) setShowScoreTab(false); }}>
        
        {/* Floating Leaderboard Sidebar - Mobile Optimized */}
        <div 
          ref={sidebarRef}
          className={cn(
            "fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-500 flex items-center",
            showScoreTab ? "translate-x-0" : "translate-x-[calc(100%-44px)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setShowScoreTab(!showScoreTab)} 
            className="w-11 h-28 bg-indigo-600 text-white rounded-l-2xl flex flex-col items-center justify-center gap-2 shadow-2xl hover:bg-indigo-700 transition-all border-y-2 border-l-2 border-white/20"
          >
            <Trophy size={20} className={cn(showScoreTab && "animate-bounce")} />
            <span className="text-[9px] font-black [writing-mode:vertical-lr] tracking-widest">RANKING</span>
            {showScoreTab ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <div className="w-[80vw] max-w-[300px] md:w-72 h-[75vh] bg-white shadow-2xl border-l-4 border-indigo-500 rounded-l-3xl p-4 md:p-5 overflow-y-auto custom-scrollbar flex flex-col text-left">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-black text-indigo-900 text-lg">최종 순위</h3>
              <span className="text-[10px] text-indigo-400 font-bold px-2 py-0.5 bg-indigo-50 rounded-full">집계완료</span>
            </div>

            {game?.options?.isTeamMode && (
              <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl shrink-0">
                <button onClick={() => setRankingTab('individual')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'individual' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>개인별</button>
                <button onClick={() => setRankingTab('team')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>팀별</button>
              </div>
            )}

            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {rankingTab === 'team' && game?.options?.isTeamMode ? (
                teamRankings.map((tr, i) => (
                  <div key={tr.teamName} className={cn("flex items-center justify-between p-3 rounded-2xl border bg-slate-50 border-slate-100", tr.teamName === me?.team ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100 shadow-sm" : "")}>
                    <div className="flex items-center gap-3">
                      <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black", i===0 ? "bg-yellow-400 text-white" : "bg-slate-200 text-slate-500")}>{i+1}</span>
                      <span className="font-bold text-sm text-slate-700 truncate max-w-[120px]">{tr.teamName === 'RED' ? '빨강팀' : tr.teamName === 'BLUE' ? '파랑팀' : tr.teamName === 'GREEN' ? '초록팀' : tr.teamName === 'YELLOW' ? '노랑팀' : tr.teamName}</span>
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
                  return <RankingItem key={p.id} rank={rank} nickname={p.nickname} score={p.score || 0} isMe={p.nickname === name} avatar_id={p.avatar_id || 1} />;
                })
              )}
            </div>
          </div>
        </div>

        {/* Main Results Card */}
        <div className="w-full max-w-md animate-pop my-4">
          <div className="bg-white rounded-[2.5rem] md:rounded-3xl shadow-2xl overflow-hidden border-b-8 border-indigo-200 flex flex-col">
            {/* Header Section */}
            <div className="bg-indigo-600 p-8 md:p-10 flex flex-col items-center text-white relative min-h-[200px] md:min-h-[220px] justify-center overflow-visible">
              <img src="/logo.png" className="absolute top-6 left-6 w-10 h-10 md:w-14 md:h-14 object-contain shadow-lg rounded-xl bg-white/20 p-1.5 backdrop-blur-sm" alt="Logo" />
              
              <div className="flex flex-col items-center mt-2">
                <div className="mb-3 animate-float">
                  <Trophy size={56} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] md:w-16 md:h-16" />
                </div>
                <h1 className="text-3xl md:text-4xl font-jua mb-1">게임 완료</h1>
                <p className="opacity-90 font-bold text-base md:text-lg">{name} 학생, 수고했어요!</p>
              </div>
              
              {/* Avatar Center - Fixed Positioning */}
              <div className="absolute bottom-0 translate-y-1/2 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-[2rem] bg-white border-4 border-white shadow-2xl z-20 flex items-center justify-center p-1.5 overflow-hidden">
                 <img 
                   src={`/avatars/avatar_${me?.avatar_id || 1}.png`} 
                   className="w-full h-full object-cover rounded-[1.5rem]" 
                   alt="Character"
                   onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                 />
              </div>
            </div>

            {/* Score & Ranking Section */}
            <div className="p-6 pt-16 md:p-10 md:pt-20 space-y-8">
              <div className="flex flex-col items-center">
                <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">FINAL SCORE</div>
                <div className="text-7xl md:text-8xl font-black text-indigo-600 drop-shadow-sm tracking-tighter">
                  {me?.score || 0}
                </div>
              </div>

              <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border-2 border-slate-100 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-yellow-400 text-white p-3 rounded-2xl shadow-lg shadow-yellow-100">
                      <Medal size={32} />
                    </div>
                    <div className="text-left">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">나의 순위</div>
                       <div className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                         {myRank === 0 ? '-' : myRank}위 <span className="text-slate-300 mx-1 font-normal">/</span> <span className="text-lg text-slate-400">{players.length}명</span>
                       </div>
                    </div>
                  </div>
                  {myRank === 1 && (
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-sm animate-pulse shadow-lg shadow-indigo-100">
                      1등 ✨
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-slate-500 font-bold leading-relaxed break-keep">
                  정말 잘했어요! <br/>
                  선생님과 친구들과 함께한 퀴즈 게임이 즐거웠나요? 😊
                </p>

                <Button 
                  variant="primary" 
                  size="xl" 
                  className="w-full py-7 rounded-[1.8rem] text-xl font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => router.push("/join")}
                >
                  홈으로 이동
                </Button>
              </div>
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
