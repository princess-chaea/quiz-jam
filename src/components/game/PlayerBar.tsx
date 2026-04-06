"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Zap, Shield, CheckCircle2 } from "lucide-react";

interface PlayerBarProps {
  players: any[];
  currentNickname?: string;
  submissions?: string[]; // IDs of players who submitted
  className?: string;
  hideBuffs?: boolean;
}

export function PlayerBar({ players, currentNickname, submissions, className, hideBuffs }: PlayerBarProps) {
  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={cn("w-full bg-white/90 backdrop-blur-md border-t border-indigo-100 p-2 flex gap-3 overflow-x-auto scrollbar-hide shrink-0 items-center", className)}>
      {/* Team Summary Pill (Only in Team Mode) */}
      {players.some(p => p.team) && (
        <div className="flex gap-2 mr-2 border-r border-indigo-100 pr-3">
          {(() => {
            const teamScores: Record<string, number> = {};
            players.forEach(p => { if(p.team) teamScores[p.team] = (teamScores[p.team] || 0) + (p.score || 0); });
            const myTeam = players.find(p => p.nickname === currentNickname)?.team;
            
            return Object.entries(teamScores).sort((a,b) => b[1]-a[1]).map(([team, score]) => {
              const colors: any = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-green-500', YELLOW: 'bg-yellow-400' };
              const isMyTeam = team === myTeam;
              return (
                <div key={team} className={cn(
                  "px-3 py-1.5 rounded-2xl flex flex-col items-center justify-center min-w-[70px] border-2 shadow-sm transition-all",
                  isMyTeam ? "bg-white border-indigo-400 ring-2 ring-indigo-50 scale-105 z-10" : "bg-slate-50 border-slate-100"
                )}>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", colors[team])} />
                    <span className="text-[9px] font-black text-slate-400">
                      {currentNickname ? (isMyTeam ? '우리팀' : '상대팀') : 
                       (team === 'RED' ? '빨강팀' : team === 'BLUE' ? '파랑팀' : team === 'GREEN' ? '초록팀' : '노랑팀')}
                    </span>
                  </div>
                  <div className="bg-white px-2 py-0.5 rounded-md shadow-sm border border-indigo-100 flex items-center shrink-0">
                    <span className="text-sm font-black text-indigo-600 tabular-nums">
                      {score.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {sortedPlayers.map((player, idx) => {
        const isMe = player.nickname === currentNickname;
        const hasSubmitted = submissions?.includes(player.id);
        const hasStrike = player.buffs?.includes('STRIKE');
        const hasShield = player.buffs?.includes('SHIELD');

        return (
          <div 
            key={player.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all shrink-0 min-w-[120px]",
              isMe 
                ? (player.team === 'RED' ? "bg-red-600 border-red-700 ring-4 ring-red-400/50 shadow-lg shadow-red-100 text-white" :
                   player.team === 'BLUE' ? "bg-blue-600 border-blue-700 ring-4 ring-blue-400/50 shadow-lg shadow-blue-100 text-white" :
                   player.team === 'GREEN' ? "bg-green-600 border-green-700 ring-4 ring-green-400/50 shadow-lg shadow-green-100 text-white" :
                   player.team === 'YELLOW' ? "bg-yellow-500 border-yellow-600 ring-4 ring-yellow-400/50 shadow-lg shadow-yellow-100 text-indigo-900" :
                   "bg-indigo-600 border-indigo-700 ring-4 ring-indigo-400/50 shadow-lg shadow-indigo-100 text-white") 
                : (player.team === 'RED' ? "bg-red-500 text-white border-red-600" :
                   player.team === 'BLUE' ? "bg-blue-500 text-white border-blue-600" :
                   player.team === 'GREEN' ? "bg-green-500 text-white border-green-600" :
                   player.team === 'YELLOW' ? "bg-yellow-400 text-indigo-900 border-yellow-500" :
                   "bg-white border-gray-100 text-gray-700 shadow-sm")
            )}
          >
            <div className="relative">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs relative overflow-hidden transition-colors border",
                player.team === 'RED' ? (isMe ? 'bg-red-500 text-white border-indigo-500 border-2' : 'bg-red-500 text-white border-red-600') :
                player.team === 'BLUE' ? (isMe ? 'bg-blue-500 text-white border-indigo-300 border-2' : 'bg-blue-500 text-white border-blue-600') :
                player.team === 'GREEN' ? (isMe ? 'bg-green-500 text-white border-indigo-500 border-2' : 'bg-green-500 text-white border-green-600') :
                player.team === 'YELLOW' ? (isMe ? 'bg-yellow-400 text-white border-indigo-500 border-2' : 'bg-yellow-400 text-white border-yellow-500') : 
                isMe ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
              )}>
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
              </div>
              {hasSubmitted && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white z-20 shadow-sm">
                  <CheckCircle2 size={10} />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0 pr-1 gap-1">
              <div className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-black truncate max-w-[90px] leading-tight",
                isMe ? "bg-white text-indigo-600 shadow-sm" : "bg-white/90 text-indigo-900 border border-white/50 shadow-sm"
              )}>
                {player.nickname}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-lg",
                  isMe ? "bg-white/20 text-white border border-white/30" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                )}>
                  {player.score.toLocaleString()}
                </span>
                {!hideBuffs && (
                  <div className="flex gap-0.5 ml-1">
                    {isMe && hasStrike && <span className="text-xs animate-pulse">⚡</span>}
                    {isMe && hasShield && <span className="text-xs">🛡️</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
