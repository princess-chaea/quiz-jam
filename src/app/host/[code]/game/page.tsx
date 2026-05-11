"use client";

import { useGame } from "@/hooks/useGame";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Play, CheckCircle, ArrowRight, AlertTriangle, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BGMPlayer } from "@/components/game/BGMPlayer";

export default function HostGameDashboard() {
  const { code } = useParams();
  const router = useRouter();
  const { game, players, loading } = useGame(code as string);
  const [currentAnswers, setCurrentAnswers] = useState<any[]>([]);

  // Fetch current round answers
  useEffect(() => {
    if (!game) return;
    const fetchAnswers = async () => {
      const { data } = await supabase
        .from("answers")
        .select("*, players(nickname)")
        .eq("game_id", game.id)
        .eq("q_index", game.current_q_index);
      setCurrentAnswers(data || []);
    };
    fetchAnswers();

    // Realtime subscription for answers
    const channel = supabase
      .channel("answers")
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${game.id}` }, 
      (payload) => {
        // Refresh answers
        fetchAnswers();
      })
      .subscribe();

    // Realtime subscription for game status changes
    const gameChannel = supabase
      .channel("game_status_changes")
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
      (payload) => {
        const newStatus = payload.new.status;
        if (newStatus === 'ENDED') {
          router.push(`/host/${code}/results`);
        } else if (newStatus === 'PLAYING') {
          // If the game status changes to PLAYING (e.g., next question),
          // the useGame hook will re-fetch and update the game object,
          // which will trigger the main useEffect to re-fetch answers for the new question.
          // No explicit action needed here beyond what useGame handles.
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(gameChannel);
    };
  }, [game?.id, game?.current_q_index, router, code]);

  const handleRevealResult = async () => {
    await supabase.from("games").update({ status: "RESULT" }).eq("code", code);
  };

  const handleNextQuestion = async () => {
    if (!game) return;
    const isLast = game.current_q_index >= (game.options?.questions?.length || 1) - 1;
    if (isLast) {
      await supabase.from("games").update({ status: "ENDED" }).eq("code", code);
      router.push(`/host/${code}/results`);
    } else {
      await supabase.from("games").update({ 
        status: "PLAYING", 
        current_q_index: game.current_q_index + 1 
      }).eq("code", code);
    }
  };

  if (loading || !game) return <div className="p-8 text-center font-bold">로딩 중...</div>;

  const currentQuestion = game?.options?.questions?.[game.current_q_index];
  const submissionRate = players.length > 0 ? (currentAnswers.length / players.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/20 flex items-center gap-2">
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">CODE</span>
            <span className="text-lg font-black text-white tracking-wider font-mono">{game.code}</span>
          </div>
          <div className="text-xl font-jua">Q.{game.current_q_index + 1} 진행 중</div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-indigo-700 px-4 py-1.5 rounded-full font-bold">
             <BarChart3 size={18} /> {currentAnswers.length} / {players.length} 정답 제출
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 flex flex-col gap-8">
        <div className="bg-indigo-50 p-10 rounded-[3rem] border-4 border-indigo-200 text-center">
          <h1 className="text-6xl font-black text-indigo-900 mb-8 break-keep">
            {currentQuestion?.q || "문제를 불러오는 중..."}
          </h1>
          <div className="flex justify-center gap-4">
            {game.status === 'PLAYING' ? (
              <Button size="xl" onClick={handleRevealResult} className="bg-orange-500 hover:bg-orange-600">
                <CheckCircle size={32} className="mr-3" /> 정답 공개!
              </Button>
            ) : (
              <Button size="xl" onClick={handleNextQuestion} className="bg-green-500 hover:bg-green-600">
                <ArrowRight size={32} className="mr-3" /> {game.current_q_index >= (game.options?.questions?.length || 1) - 1 ? "최종 결과 보기" : "다음 문제로"}
              </Button>
            )}
          </div>
        </div>

        {/* Answer Grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 overflow-y-auto pr-2">
          {players.map(player => {
            const playerAnswer = currentAnswers.find(a => a.player_id === player.id);
            return (
              <div 
                key={player.id}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center",
                  game.status === 'PLAYING' 
                    ? (playerAnswer ? "bg-indigo-600 border-indigo-700 text-white scale-105" : "bg-white border-gray-100 text-gray-400 opacity-60")
                    : (playerAnswer?.is_correct ? "bg-green-500 border-green-600 text-white animate-pop" : "bg-red-500 border-red-600 text-white opacity-80")
                )}
              >
                <div className="font-bold mb-1 truncate w-full">{player.nickname}</div>
                {game.status === 'PLAYING' ? (
                  playerAnswer ? <CheckCircle size={24} className="animate-pulse" /> : <div className="text-xs">생각 중...</div>
                ) : (
                  <div className="font-black text-lg">{playerAnswer?.answer || "미제출"}</div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Background Music Player */}
      <BGMPlayer status={game.status} />
    </div>
  );
}
