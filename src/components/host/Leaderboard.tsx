"use client";

import { Button } from "@/components/ui/Button";
import { Trophy, Home, LogOut, Medal, Zap, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  players: any[];
}

export function Leaderboard({ players }: LeaderboardProps) {
  const router = useRouter();
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const top3 = sortedPlayers.slice(0, 3);
  const others = sortedPlayers.slice(3);

  // Team Score Calculation
  const teamTotals: Record<string, number> = {};
  players.forEach(p => {
    if (p.team) {
      teamTotals[p.team] = (teamTotals[p.team] || 0) + p.score;
    }
  });
  const hasTeams = Object.keys(teamTotals).length > 0;
  const sortedTeams = Object.entries(teamTotals).sort((a,b) => b[1] - a[1]);

  const teamNames: Record<string, string> = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' };
  const teamBgColors: Record<string, string> = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-green-500', YELLOW: 'bg-yellow-400' };

  return (
    <div className="min-h-screen bg-indigo-900 overflow-y-auto p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full">
        <h1 className="text-6xl font-jua text-white text-center mb-16 animate-pop shadow-indigo-900 drop-shadow-2xl">
          🏆 최종 순위 발표 🏆
        </h1>

        {/* Team Standings (if applicable) */}
        {hasTeams && (
          <div className="mb-16 animate-in slide-in-from-bottom-10 duration-700">
             <div className="flex flex-col items-center mb-6">
                <div className="bg-indigo-800/50 px-6 py-2 rounded-2xl border border-white/10 text-indigo-200 text-sm font-black uppercase tracking-widest mb-2">Team Ranking</div>
                <div className="h-1 w-20 bg-indigo-500 rounded-full" />
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sortedTeams.map(([team, score], idx) => (
                  <div key={team} className={cn(
                    "relative p-6 rounded-3xl border-b-4 flex flex-col items-center shadow-xl transition-all hover:scale-105",
                    team === 'RED' ? "bg-red-500 border-red-700 text-white" :
                    team === 'BLUE' ? "bg-blue-500 border-blue-700 text-white" :
                    team === 'GREEN' ? "bg-green-500 border-green-700 text-white" : 
                    "bg-yellow-400 border-yellow-600 text-indigo-900"
                  )}>
                    {idx === 0 && <div className="absolute -top-3 -right-3 bg-white text-indigo-900 px-3 py-1 rounded-xl font-black text-[10px] shadow-lg animate-bounce border-2 border-indigo-100">WINNING TEAM</div>}
                    <span className="text-xs font-black opacity-80 uppercase mb-1">{teamNames[team]}</span>
                    <span className="text-3xl font-black">{score.toLocaleString()}</span>
                    <span className="text-[10px] font-bold opacity-70">POINTS</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Podium */}
        <div className="flex justify-center items-end gap-4 mb-20 px-4">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="flex flex-col items-center animate-pop" style={{ animationDelay: '200ms' }}>
              <div className="relative">
                <div className="bg-gray-300 w-24 h-24 rounded-full border-4 border-white flex items-center justify-center text-4xl mb-4 shadow-xl">
                   🥈
                </div>
                {top3[1].team && <div className={cn("absolute bottom-4 -right-1 w-8 h-8 rounded-full border-4 border-white shadow-md", teamBgColors[top3[1].team])} />}
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 w-32 text-center border border-white/10 shadow-lg">
                <div className="font-black text-white truncate">{top3[1].nickname}</div>
                <div className="text-yellow-400 font-black">{top3[1].score}점</div>
              </div>
              <div className="w-32 h-32 bg-gray-400/50 rounded-t-2xl mt-4 flex items-center justify-center text-white font-black text-2xl shadow-inner">2nd</div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="flex flex-col items-center animate-pop">
              <div className="relative">
                <div className="bg-yellow-400 w-32 h-32 rounded-full border-8 border-white flex items-center justify-center text-6xl mb-4 shadow-2xl animate-bounce">
                   🥇
                </div>
                {top3[0].team && <div className={cn("absolute bottom-4 -right-2 w-10 h-10 rounded-full border-4 border-white shadow-xl animate-pulse", teamBgColors[top3[0].team])} />}
              </div>
              <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 w-48 text-center border border-white/20 shadow-2xl relative">
                <div className="absolute -top-4 -right-4 bg-red-500 text-white p-2 rounded-xl rotate-12 font-black shadow-lg">WINNER</div>
                <div className="text-2xl font-black text-white truncate">{top3[0].nickname}</div>
                <div className="text-3xl font-black text-yellow-400 drop-shadow-md">{top3[0].score}점</div>
              </div>
              <div className="w-48 h-48 bg-yellow-500/50 rounded-t-3xl mt-4 flex items-center justify-center text-white font-black text-4xl shadow-inner">1st</div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="flex flex-col items-center animate-pop" style={{ animationDelay: '400ms' }}>
              <div className="relative">
                <div className="bg-orange-600 w-20 h-20 rounded-full border-4 border-white flex items-center justify-center text-3xl mb-4 shadow-xl">
                   🥉
                </div>
                {top3[2].team && <div className={cn("absolute bottom-4 -right-1 w-7 h-7 rounded-full border-4 border-white shadow-md", teamBgColors[top3[2].team])} />}
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 w-32 text-center border border-white/10 shadow-lg">
                <div className="font-black text-white truncate">{top3[2].nickname}</div>
                <div className="text-yellow-400 font-black">{top3[2].score}점</div>
              </div>
              <div className="w-32 h-24 bg-orange-700/50 rounded-t-2xl mt-4 flex items-center justify-center text-white font-black text-2xl shadow-inner">3rd</div>
            </div>
          )}
        </div>

        {/* Individual Ranking Title */}
        {others.length > 0 && (
          <div className="flex flex-col items-center mb-6">
             <div className="bg-indigo-800/50 px-6 py-2 rounded-2xl border border-white/10 text-indigo-200 text-sm font-black uppercase tracking-widest mb-2">Individual Ranking</div>
             <div className="h-1 w-10 bg-indigo-500 rounded-full" />
          </div>
        )}

        {/* Other Players */}
        {others.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 mb-12 border border-white/10">
            {others.map((player, index) => (
              <div 
                key={player.id} 
                className="flex justify-between items-center p-4 border-b border-white/10 last:border-0 hover:bg-white/5 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white/40 font-black text-xl w-8">{index + 4}</span>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white relative overflow-hidden">
                    {player.avatar_id ? (
                      <img 
                        src={`/avatars/avatar_${player.avatar_id}.png`} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.innerText = player.nickname[0];
                        }}
                      />
                    ) : (
                      player.nickname[0]
                    )}
                    {player.team && (
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-indigo-900",
                        player.team === 'RED' ? 'bg-red-500' :
                        player.team === 'BLUE' ? 'bg-blue-500' :
                        player.team === 'GREEN' ? 'bg-green-500' : 'bg-yellow-400'
                      )} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <span className="text-xl font-bold text-white">{player.nickname}</span>
                       <div className="flex gap-1">
                         {player.buffs?.includes('STRIKE') && <Zap size={14} className="text-yellow-400 fill-yellow-400 animate-pulse" />}
                         {/* Shield is secret! Hiding it here too */}
                         {/* player.buffs?.includes('SHIELD') && <Shield size={14} className="text-blue-400 fill-blue-400 animate-pulse" /> */}
                       </div>
                    </div>
                    {player.team && (
                      <span className="text-[10px] font-black opacity-50 text-white uppercase tracking-wider">
                        {player.team === 'RED' ? '빨강팀' :
                         player.team === 'BLUE' ? '파랑팀' :
                         player.team === 'GREEN' ? '초록팀' : '노랑팀'}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-2xl font-black text-indigo-300">{player.score}점</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-center">
           <Button 
             size="xl" 
             className="px-16 py-8 bg-white text-indigo-900 hover:bg-gray-100 font-black shadow-2xl rounded-3xl text-2xl"
             onClick={() => router.push("/dashboard")}
           >
             <Home className="mr-2" size={28} /> 대시보드로 돌아가기
           </Button>
        </div>
      </div>
    </div>
  );
}
