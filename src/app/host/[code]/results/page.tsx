"use client";

import { useGame } from "@/hooks/useGame";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Trophy, Home, Medal, Crown } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function ResultsPage() {
  const { code } = useParams();
  const router = useRouter();
  const { game, players, loading } = useGame(code as string);

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Calculate ranks using competition ranking (1, 1, 1, 4)
  const rankedPlayers = sortedPlayers.map((player, index) => {
    if (index > 0 && player.score === sortedPlayers[index - 1].score) {
      return { ...player, rank: (sortedPlayers as any)[index - 1].rank };
    }
    return { ...player, rank: index + 1 };
  });
  
  // Update sortedPlayers to include rank
  const finalSortedPlayers = rankedPlayers;

  // Team score calculation
  const isTeamMode = game?.options?.isTeamMode;
  const teamNames: Record<string, string> = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' };
  const teamScores = isTeamMode ? players.reduce((acc, p) => {
    if (p.team) {
      acc[p.team] = (acc[p.team] || 0) + (p.score || 0);
    }
    return acc;
  }, {} as Record<string, number>) : {};

  const sortedTeams = Object.entries(teamScores)
    .map(([team, score]) => ({ team, score, name: teamNames[team] }))
    .sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (!loading && players.length > 0) {
      const duration = 10 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [loading, players.length]);

  if (loading) return (
    <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center text-white font-jua">
      <div className="animate-spin mb-4 text-yellow-400">
        <Trophy size={64} />
      </div>
      <h2 className="text-2xl">최종 순위를 집계하고 있습니다...</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a1b4b] bg-gradient-to-br from-[#1a1b4b] via-[#2d1b4b] to-[#1a1b4b] text-white flex flex-col items-center p-6 md:p-12 overflow-x-hidden">
      <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in zoom-in duration-1000">
        
        {/* Header Section */}
        <div className="text-center mb-16 relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 opacity-20 blur-3xl w-64 h-64 bg-yellow-400 rounded-full" />
          <Crown size={80} className="mx-auto text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-bounce" />
          <h1 className="text-7xl md:text-[8rem] font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 mb-4 drop-shadow-2xl">
            FINAL STANDINGS
          </h1>
          <p className="text-2xl font-jua text-indigo-300 opacity-80 uppercase tracking-[0.5em]">최종 순위 발표!</p>
        </div>

        {/* --- TEAM STANDINGS (New Section) --- */}
        {isTeamMode && sortedTeams.length > 0 && (
          <div className="w-full mb-32 space-y-10 animate-in slide-in-from-bottom-10 duration-700">
            <h3 className="text-3xl font-black text-center text-indigo-400 uppercase tracking-[0.4em] flex items-center justify-center gap-6">
               <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-indigo-500/50" />
               Team Rankings
               <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-indigo-500/50" />
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {sortedTeams.map((team, idx) => (
                <div 
                  key={team.team}
                  className={cn(
                    "relative group p-8 rounded-[3rem] border-4 transition-all hover:scale-105 shadow-2xl overflow-hidden",
                    team.team === 'RED' ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-red-500/10' :
                    team.team === 'BLUE' ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-blue-500/10' :
                    team.team === 'GREEN' ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-green-500/10' : 
                    'bg-yellow-500/10 border-yellow-500/40 text-yellow-400 shadow-yellow-500/10'
                  )}
                >
                  {/* Background Rank Number */}
                  <div className="absolute -bottom-6 -right-4 text-[10rem] font-black italic opacity-10 select-none">
                    {idx + 1}
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl mb-4 shadow-lg",
                      idx === 0 ? "bg-yellow-400 text-indigo-900" : "bg-white/10 text-white"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="text-3xl font-black mb-2">{team.name}</div>
                    <div className="text-2xl font-black opacity-80">{team.score.toLocaleString()} PTS</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-3xl font-black text-center text-indigo-400 uppercase tracking-[0.4em] mb-12 flex items-center justify-center gap-6">
           <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-indigo-500/50" />
           Individual MVP
           <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-indigo-500/50" />
        </h3>

        {/* The Podium */}
        <div className="grid grid-cols-3 gap-2 md:gap-6 items-end mb-24 w-full px-4 relative">
          {/* Background glow for podium */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1/2 bg-indigo-500/10 blur-[120px] -z-10" />

          {finalSortedPlayers[1] && (
            <div className="flex flex-col items-center animate-in slide-in-from-bottom-20 duration-700 delay-300">
              <div className="mb-6 text-center z-20">
                <div className="text-xl md:text-3xl font-black truncate max-w-[120px] text-slate-300 drop-shadow-lg uppercase tracking-tight">
                  {finalSortedPlayers[1]?.nickname || "---"}
                </div>
                <div className="text-lg font-black text-slate-400">{finalSortedPlayers[1]?.score?.toLocaleString() || 0} PTS</div>
              </div>
              
              {/* Player Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden mb-[-2rem] z-30 shadow-xl p-1 relative">
                 <img 
                   src={`/avatars/avatar_${finalSortedPlayers[1]?.avatar_id || 1}.png`} 
                   className="w-full h-full object-cover rounded-xl" 
                   alt="char"
                   onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                 />
              </div>

              <div className="w-full bg-gradient-to-t from-slate-500 to-slate-400 h-44 md:h-64 rounded-t-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center relative border-x-4 border-t-4 border-white/20 group hover:scale-105 transition-transform overflow-hidden pt-8">
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="relative flex items-center justify-center mt-4">
                   <Medal size={64} className="text-slate-100 drop-shadow-lg" />
                   <span className="absolute text-slate-500 font-black text-xl mt-1.5">2</span>
                 </div>
                 <div className="absolute bottom-6 md:bottom-10 text-5xl md:text-6xl font-black text-slate-900/20 italic select-none">{finalSortedPlayers[1]?.rank}nd</div>
              </div>
            </div>
          )}

          {finalSortedPlayers[0] && (
            <div className="flex flex-col items-center z-10 animate-in slide-in-from-bottom-24 duration-1000">
              <div className="mb-8 text-center drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                <div className="text-3xl md:text-5xl font-black truncate max-w-[200px] text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)] animate-pulse uppercase tracking-tight">
                  {finalSortedPlayers[0]?.nickname || "---"}
                </div>
                <div className="text-2xl font-black text-yellow-200">{finalSortedPlayers[0]?.score?.toLocaleString() || 0} PTS</div>
              </div>
              
              {/* Player Avatar */}
              <div className="w-32 h-32 rounded-3xl bg-white/10 border-4 border-yellow-200 overflow-hidden mb-[-3rem] z-30 shadow-[0_0_30px_rgba(250,204,21,0.3)] p-1.5 relative">
                 <img 
                   src={`/avatars/avatar_${finalSortedPlayers[0]?.avatar_id || 1}.png`} 
                   className="w-full h-full object-cover rounded-2xl" 
                   alt="char"
                   onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                 />
                 <div className="absolute top-1 right-1 bg-yellow-400 text-indigo-900 p-1 rounded-lg">
                   <Crown size={18} />
                 </div>
              </div>

              <div className="w-full bg-gradient-to-t from-yellow-600 to-yellow-400 h-72 md:h-96 rounded-t-[3rem] shadow-[0_20px_60px_-10px_rgba(250,204,21,0.4)] flex flex-col items-center justify-center relative border-x-4 border-t-4 border-yellow-200 group hover:scale-105 transition-transform overflow-hidden pt-12">
                 {/* Shine effect */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
                 <Trophy size={100} className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] mb-2 animate-pop mt-4" />
                 <div className="absolute bottom-10 md:bottom-14 text-[6rem] md:text-[8rem] font-black text-yellow-900/20 italic select-none leading-none">{finalSortedPlayers[0]?.rank}st</div>
              </div>
            </div>
          )}

          {finalSortedPlayers[2] && (
            <div className="flex flex-col items-center animate-in slide-in-from-bottom-16 duration-700 delay-500">
              <div className="mb-6 text-center z-20">
                <div className="text-xl md:text-3xl font-black truncate max-w-[120px] text-orange-300 drop-shadow-lg uppercase tracking-tight">
                  {finalSortedPlayers[2]?.nickname || "---"}
                </div>
                <div className="text-lg font-black text-orange-400">{finalSortedPlayers[2]?.score?.toLocaleString() || 0} PTS</div>
              </div>
              
              {/* Player Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-orange-200/40 overflow-hidden mb-[-1.5rem] z-30 shadow-xl p-1 relative">
                 <img 
                   src={`/avatars/avatar_${finalSortedPlayers[2]?.avatar_id || 1}.png`} 
                   className="w-full h-full object-cover rounded-xl" 
                   alt="char"
                   onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                 />
              </div>

              <div className="w-full bg-gradient-to-t from-orange-600 to-orange-500 h-36 md:h-52 rounded-t-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center relative border-x-4 border-t-4 border-white/20 group hover:scale-105 transition-transform overflow-hidden pt-4">
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="relative flex items-center justify-center mt-2">
                   <Medal size={56} className="text-orange-100 drop-shadow-lg" />
                   <span className="absolute text-orange-800 font-black text-lg mt-1">3</span>
                 </div>
                 <div className="absolute bottom-4 md:bottom-8 text-4xl md:text-5xl font-black text-orange-900/20 italic select-none">{finalSortedPlayers[2]?.rank}rd</div>
              </div>
            </div>
          )}

        </div>

        {/* Lower Rankings List - Show ALL players from 4th place down */}
        {finalSortedPlayers.length > 3 && (
          <div className="w-full max-w-4xl bg-white/10 backdrop-blur-xl rounded-[3rem] p-8 md:p-12 mb-20 border border-white/20 shadow-2xl animate-in fade-in duration-1000 delay-700">
            <h3 className="text-2xl font-black text-indigo-400 uppercase tracking-widest mb-10 text-center flex items-center justify-center gap-4">
               <div className="h-px w-12 bg-indigo-500/30" />
               Ranking Board
               <div className="h-px w-12 bg-indigo-500/30" />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
              {finalSortedPlayers.slice(3).map((player, index) => (
                <div 
                  key={player.id} 
                  className="flex justify-between items-center p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group scale-100 hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-indigo-500 font-black text-2xl italic opacity-50 group-hover:opacity-100 transition-opacity shrink-0">#{player.rank}</span>
                    <div className="w-12 h-12 rounded-xl bg-white/10 p-0.5 border border-white/10 shrink-0">
                      <img 
                         src={`/avatars/avatar_${player.avatar_id || 1}.png`} 
                         className="w-full h-full object-cover rounded-lg" 
                         alt="char"
                         onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                      />
                    </div>
                    <span className="text-2xl font-black tracking-tight truncate">{player.nickname}</span>

                    {player.team && (
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                        player.team === 'RED' ? 'bg-red-500/20 text-red-400' :
                        player.team === 'BLUE' ? 'bg-blue-500/20 text-blue-400' :
                        player.team === 'GREEN' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {teamNames[player.team]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xl font-black text-white">{(player.score || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Points</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single Action Button */}
        <div className="mb-20 animate-in slide-in-from-top-10 duration-700 delay-1000">
           <Button 
             size="xl" 
             onClick={() => router.push("/")} 
             className="px-16 py-8 text-2xl font-black rounded-full bg-white text-indigo-900 hover:bg-indigo-50 transition-all shadow-[0_10px_20px_-5px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_30px_-5px_rgba(255,255,255,0.3)] hover:-translate-y-1 active:scale-95 group"
           >
             <Home size={28} className="mr-4 group-hover:rotate-12 transition-transform" /> 
             대시보드로 돌아가기
           </Button>
        </div>
      </div>
    </div>
  );
}
