"use client";

import { useGame } from "@/hooks/useGame";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Loader2, Zap, HelpCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { GameDisplay } from "@/components/game/GameDisplay";
import { cn, normalizeMath } from "@/lib/utils";
import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { PlayerBar } from "@/components/game/PlayerBar";
import { useDialog } from "@/components/ui/DialogProvider";

function StudentPlayContent() {
  const { code } = useParams();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const router = useRouter();
  
  const { game, players, loading, error, refresh } = useGame(code as string);
  const gameRef = useRef(game);
  
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const { showAlert, showConfirm } = useDialog();
  const [playerResult, setPlayerResult] = useState<any>(null);
  const [wasKicked, setWasKicked] = useState(false);
  const [hasFoundMe, setHasFoundMe] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // 1. Memoized Answer Submission to avoid re-renders or closures inside conditional blocks
  const handleSubmitAnswer = useCallback(async (answer: string) => {
    const me = players.find(p => p.nickname === name);
    if (!me || !game || !game.options?.questions) return;
    try {
      const questions = game.options.questions;
      const currentQuestion = questions[game.current_q_index];
      if (!currentQuestion) return;

      const isCorrect = normalizeMath(answer) === normalizeMath(currentQuestion.a);
      
      const { error: insertErr } = await supabase
        .from("answers")
        .insert([{
          game_id: game.id,
          player_id: me.id,
          q_index: game.current_q_index,
          answer: answer.trim(),
          is_correct: isCorrect,
          event: 'none',
          points_awarded: 0
        }]);

      if (insertErr) throw insertErr;
    } catch (err: any) {
      showAlert("정답 제출 실패: " + err.message);
    }
  }, [game, players, name, showAlert]);

  // 1. Game result redirection
  useEffect(() => {
    if (game?.status === 'ENDED') {
      console.log("Game ended, redirecting to results...");
      const encodedName = encodeURIComponent(name);
      router.replace(`/play/${code}/results?name=${encodedName}`);
    }
  }, [game?.status, code, name, router]);

  // 2. Real-time broadcast listener for instant kick
  useEffect(() => {
    if (!game?.id || !name) return;

    const channel = supabase
      .channel(`game_events_${game.id}`)
      .on('broadcast', { event: 'KICK_PLAYER' }, (payload: any) => {
        if (payload.payload.nickname === name) {
          console.log("Kicked via broadcast!");
          setWasKicked(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, name]);

  // 3. User Exiting manually (optional, but we keep the state flag)
  const handleManualExit = () => {
    setIsExiting(true);
    router.push("/");
  };

  // 4. Check if kicked or game closed via DB (fallback for broadcast)
  useEffect(() => {
    if (loading || !name || !game || wasKicked) return;

    const meExists = players.some(p => p.nickname === name);
    
    if (meExists) {
      setHasFoundMe(true);
    } else {
      if (hasFoundMe) {
        console.log("Student no longer in player list - triggering kick state");
        setWasKicked(true);
      }
    }
  }, [players.length, name, loading, hasFoundMe, !!game, wasKicked]);

  // 5. AUTO-DELETE on Lobby Exit
  useEffect(() => {
    // We need to keep track of the latest 'me' and 'game' without re-triggering the effect on every players change
    const me = players.find(p => p.nickname === name);
    if (!me || !game || game.status !== 'WAITING') return;

    const deleteMe = async () => {
      console.log("[Lobby] Deleting player on exit...", name);
      // Use best-effort delete
      await supabase.from("players").delete().eq("id", me.id);
    };

    const handleBeforeUnload = () => {
      deleteMe();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Only delete if we are explicitly leaving (unmounting) while still in WAITING room
      // and NOT because we are being redirected to results or starting the game.
      if (gameRef.current?.status === 'WAITING' && !isExiting) {
        deleteMe();
      }
    };
    // CRITICAL: We DO NOT include players.length here. 
    // We only want this effect to set up the exit listeners once when we successfully join.
  }, [game?.status === 'WAITING', name, isExiting]);

  // 4. Fetch round result logic
  useEffect(() => {
    if (!game?.id || !name || wasKicked) return;

    const fetchResult = async () => {
      const currentMe = players.find(p => p.nickname === name);
      if (!currentMe) return;

      console.log("Fetching round result for index:", game.current_q_index);
      const { data, error: fetchErr } = await supabase
        .from("answers")
        .select("*")
        .eq("game_id", game.id)
        .eq("player_id", currentMe.id)
        .eq("q_index", game.current_q_index)
        .maybeSingle();
      
      if (fetchErr) {
        console.error("Result fetch error:", fetchErr);
      } else if (data) {
        console.log("Fetched result data:", data);
        setPlayerResult((prev: any) => {
          // If we already received a rich broadcasted event, don't let a stale DB value (event='none') overwrite it
          if (prev && prev.q_index === data.q_index && prev.event !== 'none' && (!data.event || data.event === 'none')) {
            console.log("Preserving rich broadcasted result over stale DB result", prev);
            return prev;
          }
          return data;
        });
      }
    };

    if (game.status === 'RESULT') {
      fetchResult();
    } else if (game.status === 'PLAYING') {
      setPlayerResult(null);
    }

    const channel = supabase
      .channel(`game_results_${game.id}`)
      .on('broadcast', { event: 'ROUND_RESULTS_READY' }, (payload: any) => {
        console.log("Broadcast: ROUND_RESULTS_READY", payload);
        if (payload.payload.q_index === game.current_q_index) {
          const resultsArray = payload.payload.results;
          if (resultsArray) {
            const currentMe = players.find(p => p.nickname === name);
            const myResult = resultsArray.find((r: any) => r.player_id === currentMe?.id);
            if (myResult) {
               console.log("Applying rich broadcasted result directly:", myResult);
               setPlayerResult(myResult);
               return; // Skip fetching from DB if we got it from broadcast
            }
          }
          fetchResult();
        }
      })
      .subscribe();

    const me = players.find(p => p.nickname === name);
    let answerChannel: any = null;
    if (me) {
      answerChannel = supabase
        .channel(`answer_sync_${me.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'answers', filter: `player_id=eq.${me.id}` },
          (payload: any) => {
            if (payload.new.game_id === game.id && payload.new.q_index === game.current_q_index) {
              console.log("Realtime: Answer updated", payload.new);
              setPlayerResult(payload.new);
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (answerChannel) supabase.removeChannel(answerChannel);
    };
  }, [game?.status, game?.id, game?.current_q_index, name, wasKicked, players.length]);

  // --- RENDERING LOGIC ---
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-yellow-50 font-jua text-indigo-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h2 className="text-xl font-bold">서버와 대화 중...</h2>
      </div>
    );
  }

  if (wasKicked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <h2 className="text-3xl font-jua text-red-600 mb-4">방에서 강퇴되었습니다!</h2>
        <p className="text-gray-500 mb-8 font-bold text-lg">새로운 이름으로 다시 입장할 수 있습니다.</p>
        <Button size="xl" onClick={() => router.push("/join")}>다시 입장하기</Button>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">입장 정보를 찾을 수 없습니다.</h2>
        <Button onClick={() => router.push("/")}>홈으로 돌아가기</Button>
      </div>
    );
  }

  if (game.status === 'ENDED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua text-indigo-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h2 className="text-xl font-bold">결과창으로 이동 중...</h2>
      </div>
    );
  }

  const me = players.find(p => p.nickname === name);
  
  if (!me && !loading) {
     // If we are not loading anymore but 'me' isn't found, 
     // it's likely they were cleaned up or never existed.
     // Redirect to join page to re-verify/re-insert.
     console.log("Player record not found, redirecting to join...");
     const encodedCode = encodeURIComponent(code as string);
     const encodedName = encodeURIComponent(name);
     router.replace(`/join?code=${encodedCode}&name=${encodedName}`);
     return null;
  }

  // --- MAIN CONTENT ---
  return (
    <div className="min-h-screen flex flex-col">
       <main className="flex-1 flex flex-col items-center justify-center p-6 bg-indigo-50">
          {game.status === 'WAITING' ? (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-indigo-50 w-full rounded-3xl">
                <div className="animate-bounce mb-8">
                  <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl border-8 border-indigo-100 relative">
                    <img src="/logo.png" alt="Quiz Jam Logo" className="w-24 h-24 object-contain translate-y-1" />
                    <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl animate-pulse">
                      <Zap size={24} fill="white" />
                    </div>
                  </div>
                </div>
                <h1 className="text-4xl font-jua text-indigo-900 mb-4">선생님이 게임을 <br/>시작하기를 기다리고 있어요!</h1>
                <p className="text-gray-500 font-bold mb-8">준비를 마쳤나요? <br/>곧 재미있는 퀴즈가 시작됩니다!</p>
                {me?.team && (
                  <div className={cn(
                    "p-6 rounded-3xl shadow-lg border-4 w-full max-w-sm animate-pop",
                    me.team === 'RED' ? 'bg-red-50 border-red-200 text-red-700' :
                    me.team === 'BLUE' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    me.team === 'GREEN' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  )}>
                    <div className="text-sm font-black uppercase tracking-widest mb-1">My Team</div>
                    <h3 className="text-3xl font-jua mb-4">{me.team === 'RED' ? '빨강팀' : me.team === 'BLUE' ? '파랑팀' : me.team === 'GREEN' ? '초록팀' : '노랑팀'}</h3>
                    <div className="flex justify-center gap-3">
                      {players.filter(p => p.team === me.team && p.nickname !== name).map(p => (
                        <div key={p.id} className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center font-bold shadow-sm overflow-hidden" title={p.nickname}>
                          {p.avatar_id ? (
                            <img 
                              src={`/avatars/avatar_${p.avatar_id}.png`} 
                              alt="" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerText = p.nickname[0];
                              }}
                            />
                          ) : (
                            p.nickname[0]
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-12">
                  <Button 
                    variant="ghost" 
                    onClick={async () => {
                      const confirmed = await showConfirm("정말로 방에서 나가시겠습니까?");
                      if (!confirmed) return;
                      
                      if (me) {
                        setIsExiting(true);
                        try {
                          const { error: delErr } = await supabase.from("players").delete().eq("id", me.id);
                          if (delErr) {
                            console.error("Exit deletion failed:", delErr);
                            // We still redirect, but log the error
                          }
                        } catch (err) {
                          console.error("Exit error:", err);
                        }
                      }
                      router.push("/join");
                    }} 
                    disabled={isExiting}
                    className="text-gray-400"
                  >
                    <LogOut size={18} className="mr-2" /> 나가기
                  </Button>
                </div>
             </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <GameDisplay 
                game={game} 
                player={me} 
                players={players} 
                onSubmit={handleSubmitAnswer} 
                refresh={refresh}
                result={playerResult}
              />
              <div className="h-20" /> {/* Spacer */}
            </div>
          )}
       </main>
       
       {/* Lifted PlayerBar to ensure it's always at the bottom and stable */}
       <PlayerBar 
          players={players} 
          currentNickname={name}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 border-t-2 shadow-2xl transition-all duration-300",
            (game.status === 'PLAYING' || game.status === 'RESULT') ? "border-indigo-200" : "border-indigo-100 bg-white"
          )}
       />
    </div>
  );
}

export default function StudentPlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua text-indigo-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h2 className="text-xl font-bold">게임 데이터를 불러오는 중...</h2>
      </div>
    }>
      <StudentPlayContent />
    </Suspense>
  );
}
