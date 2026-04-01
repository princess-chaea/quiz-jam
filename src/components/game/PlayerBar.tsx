"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Zap, Shield, CheckCircle2 } from "lucide-react";

interface PlayerBarProps {
  players: any[];
  currentNickname?: string;
  submissions?: string[]; // IDs of players who submitted
  className?: string;
}

export function PlayerBar({ players, currentNickname, submissions, className }: PlayerBarProps) {
  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={cn("w-full bg-white/80 backdrop-blur-md border-t border-indigo-100 p-2 flex gap-3 overflow-x-auto scrollbar-hide shrink-0", className)}>
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
                ? "bg-white border-indigo-500 ring-4 ring-indigo-400/50 shadow-lg shadow-indigo-100" 
                : "bg-white border-gray-100 text-gray-700 shadow-sm"
            )}
          >
            <div className="relative">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs relative overflow-hidden",
                player.team === 'RED' ? 'bg-red-500 text-white' :
                player.team === 'BLUE' ? 'bg-blue-500 text-white' :
                player.team === 'GREEN' ? 'bg-green-500 text-white' :
                player.team === 'YELLOW' ? 'bg-yellow-400 text-white' : 
                (isMe ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-50 text-indigo-600')
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
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white z-20">
                  <CheckCircle2 size={10} />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0 pr-1">
              <span className={cn(
                "text-[11px] font-black truncate max-w-[80px] leading-tight",
                isMe ? "text-indigo-600" : "text-indigo-900"
              )}>{player.nickname}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-lg",
                  isMe ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                )}>
                  {player.score.toLocaleString()}
                </span>
                {isMe && (
                  <div className="flex gap-0.5 ml-1">
                    {hasStrike && <span className="text-xs animate-pulse">⚡</span>}
                    {hasShield && <span className="text-xs">🛡️</span>}
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
