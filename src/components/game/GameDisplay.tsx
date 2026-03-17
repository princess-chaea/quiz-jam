"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Clock, Zap, Shield, Scissors, Gift, RefreshCw, Check, X } from "lucide-react";
import { cn, getChoseong, processMathText, normalizeMath } from "@/lib/utils";
import { useDialog } from "@/components/ui/DialogProvider";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MathInput } from "@/components/ui/MathInput";

// --- Sub-component for Segmented Blank Input ---
interface SegmentedInputProps {
  value: string;
  length: number;
  onChange: (val: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  firstRef?: any;
}

function SegmentedInput({ value, length, onChange, onEnter, autoFocus, firstRef }: SegmentedInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, val: string) => {
    // Only take the last character typed
    const char = val.slice(-1);
    const chars = value.split("");
    while(chars.length < length) chars.push("");
    chars[i] = char;
    const newVal = chars.join("").slice(0, length);
    onChange(newVal);
    
    if (char && i < length - 1) {
      inputsRef.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === 'Enter') onEnter?.();
    if (e.key === 'ArrowRight' && i < length - 1) inputsRef.current[i + 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").slice(0, length);
    onChange(paste);
    // Focus the next empty slot or the last one
    const nextIdx = Math.min(paste.length, length - 1);
    inputsRef.current[nextIdx]?.focus();
  };

  return (
    <div className="flex gap-1 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => {
            inputsRef.current[i] = el;
            if (i === 0 && firstRef) firstRef.current = el;
          }}
          type="text"
          maxLength={1}
          value={value[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={autoFocus && i === 0}
          className="w-10 h-12 bg-slate-50 border-2 border-indigo-100 rounded-lg text-center font-black text-indigo-600 text-xl focus:border-indigo-400 focus:bg-indigo-50/30 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
        />
      ))}
    </div>
  );
}

interface GameDisplayProps {
  game: any;
  player: any;
  players: any[];
  onSubmit: (answer: string) => void;
  refresh: () => void;
  result: any;
}

export function GameDisplay({ game, player, players, onSubmit, refresh, result }: GameDisplayProps) {
  const [answer, setAnswer] = useState("");
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [shieldBlock, setShieldBlock] = useState<{nickname: string, type: string} | null>(null);
  const isComposing = useRef(false);
  const confettiTriggered = useRef<string | null>(null); // Track which result (q_index) triggered confetti
  const currentQuestion = game.options?.questions[game.current_q_index];
  const supabaseRef = useRef(null);
  const swapChannelRef = useRef<any>(null);
  const firstBlankRef = useRef<HTMLInputElement>(null);

  // --- Sequential Interactive Swap Selection ---
  const [isMyTurnToSwap, setIsMyTurnToSwap] = useState(false);
  const [swapCommitted, setSwapCommitted] = useState(false);
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);
  const [activeSwapperName, setActiveSwapperName] = useState<string | null>(null);
  const [swapResultText, setSwapResultText] = useState<string | null>(null);
  const [pendingSwapTarget, setPendingSwapTarget] = useState<any>(null);

  const handleSwapSelection = async (targetId: string | null, targetName: string | null) => {
    if (isSwapExecuting || !isMyTurnToSwap) return;
    
    // If selecting a target (not skip) and not confirmed yet
    if (targetId && !pendingSwapTarget) {
      const target = players.find(p => p.id === targetId);
      setPendingSwapTarget(target);
      return;
    }

    setIsSwapExecuting(true);
    setPendingSwapTarget(null);
    
    try {
      // 1. Mark as consumed in database LOCALLY from student side for maximum reliability
      if (result?.id) {
         console.log(`[Swap Engine] Marking local answer ${result.id} as done...`);
         const newEvent = (result.event || "")
           .split(',')
           .map((e: string) => e.trim() === 'swap' ? 'swap_done' : e)
           .join(',');
         
         const { error: localUpdErr } = await supabase
           .from('answers')
           .update({ event: newEvent })
           .eq('id', result.id);
         
         if (localUpdErr) console.error("[Swap Engine] Local DB Update error:", localUpdErr);
      }

      // 2. Broadcast to Host to perform the actual point swap
      // Use persistent channel ref instead of creating temporary ones
      if (swapChannelRef.current) {
        console.log(`[Swap Engine] Broadcasting EXECUTE_SWAP to host for ${player.nickname}...`);
        await swapChannelRef.current.send({
          type: 'broadcast',
          event: 'EXECUTE_SWAP',
          payload: {
            swapperId: player.id,
            targetId: targetId // Will be null if skipped
          }
        });
      } else {
        console.error("[Swap Engine] Error: Swap channel not initialized!");
      }

      if (targetId) {
        setSwapResultText(`${targetName} 학생을 선택했습니다!\n교체 결과를 기다리는 중...`);
      } else {
        setSwapResultText(`점수를 바꾸지 않기로 선택했습니다.\n다음 차례를 기다리는 중...`);
      }
    } catch (err) {
      console.error("Swap execution failed:", err);
      setIsSwapExecuting(false);
    }

    // Safety timeout: If no response from Host in 5 seconds, unlock the UI
    setTimeout(() => {
      setIsSwapExecuting(false);
    }, 5000);
  };

  useEffect(() => {
    if (!game?.id || !player.id) return;
    
    const channel = supabase.channel(`game_swaps_${game.id}`)
      .on('broadcast', { event: 'START_SWAP' }, ({ payload }: { payload: any }) => {
        console.log(`[Swap Engine] Student ${player.nickname} received START_SWAP for ${payload.nickname} (${payload.playerId})`);
        setActiveSwapperName(payload.nickname);
        
        // Exact string comparison for IDs to avoid any type issues
        const myId = String(player.id || "").trim();
        const swapperId = String(payload.playerId || "").trim();
        const myNick = String(player.nickname || "").trim();
        const swapperNick = String(payload.nickname || "").trim();

        const isMe = swapperId === myId || (swapperNick === myNick && swapperNick !== "");

        if (isMe) {
          console.log(`>>> [Swap Engine] SUCCESS: Targeted me (${player.nickname}). Opening selection UI.`);
          setIsMyTurnToSwap(true);
          setSwapResultText(null);
        } else {
          console.log(`>>> [Swap Engine] INFO: Target is not me. Showing waiting state for ${payload.nickname}.`);
          setIsMyTurnToSwap(false);
        }
      })
      .on('broadcast', { event: 'SWAP_COMPLETED' }, ({ payload }: { payload: any }) => {
        const { swapperId, targetId, swapperName, targetName, skipped } = payload;
        console.log(`[Swap Engine] Received SWAP_COMPLETED: ${swapperName} -> ${targetName} (Skipped: ${skipped})`);
        setActiveSwapperName(null);
        setIsSwapExecuting(false); 
        
        if (swapperId === player.id) {
          if (skipped) {
            setSwapResultText(`이번에는 점수를 바꾸지 않기로 했어요! 😊`);
          } else {
            setSwapResultText(`${targetName} 학생과 점수가 교체되었습니다! 🔄`);
            confetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
          }
          setIsMyTurnToSwap(false);
          setSwapCommitted(true);
        } else if (targetId === player.id && !skipped) {
          setSwapResultText(`${swapperName} 학생과 점수가 교체되었습니다! 🔄`);
          // Note: We DO NOT set swapCommitted(true) here because this student 
          // might still have their own swap turn later in the same round.
        }
      })
      .on('broadcast', { event: 'SHIELD_BLOCK' }, ({ payload }: { payload: any }) => {
        const { nickname, type } = payload;
        setActiveSwapperName(null);
        setIsSwapExecuting(false); // Critical: Unlock the Confirm button
        if (type === 'swap' && isMyTurnToSwap) {
          setSwapResultText(`${nickname} 학생의 방패에 막혔습니다! 🛡️`);
          setIsMyTurnToSwap(false);
          setSwapCommitted(true);
        }
      })
      .on('broadcast', { event: 'GAME_UPDATE' }, () => {
        console.log("[useGame] GAME_UPDATE broadcast received. Refreshing...");
        if (refresh) refresh();
      })
      .subscribe();
    
    swapChannelRef.current = channel;
      
    return () => { 
      swapChannelRef.current = null;
      supabase.removeChannel(channel); 
    };
  }, [game?.id, player.id]);

  // Auto-close swap result modal after 3 seconds
  useEffect(() => {
    if (swapResultText && !isSwapExecuting) {
      const timer = setTimeout(() => {
        console.log(">>> [Swap Engine] Auto-closing result modal...");
        setIsMyTurnToSwap(false);
        setSwapResultText(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [swapResultText, isSwapExecuting]);

  // Synchronize local swap state with DB source of truth (Persistent Fallback)
  useEffect(() => {
    const swapState = game?.options?.swapState;
    if (!swapState || game.status !== 'RESULT') {
       // Reset if no active swap
       setActiveSwapperName(null);
       setIsMyTurnToSwap(false);
       return;
    }

    const currentNick = swapState.currentSwapperNickname;
    const currentId = String(swapState.currentSwapperId || "").trim();
    const myId = String(player.id || "").trim();
    
    // 1. Set the global "Who is swapping?" label for everyone
    setActiveSwapperName(currentNick);
    
    // 2. Determine if it's MY turn
    const isMe = currentId === myId;

    if (isMe) {
      // --- LOOP PREVENTION GUARD ---
      // If we don't have our result record yet, wait for it before deciding to open UI.
      // If we already marked our result as 'swap_done', DO NOT open the UI again.
      const alreadyDone = result?.event?.includes('swap_done');
      
      if (!result) {
        console.log("[Swap Engine] DB Sync: It's my turn, but waiting for 'result' data...");
        return;
      }

      if (alreadyDone) {
        console.log("[Swap Engine] DB Sync: It's my turn, but I already finished swapping (swap_done). Skipping UI.");
        setIsMyTurnToSwap(false);
        setSwapCommitted(true); // Ensure internal state reflects completion
        return;
      }

      if (!isMyTurnToSwap && !swapCommitted) {
        console.log(">>> [Swap Engine] DB Sync: It is MY turn. Opening UI.");
        setIsMyTurnToSwap(true);
        setSwapResultText(null);
      }
    } else {
      if (isMyTurnToSwap) {
        console.log(">>> [Swap Engine] DB Sync: Not my turn anymore. Closing UI.");
        setIsMyTurnToSwap(false);
      }
      // If the turn moved away from me, reset my committed state for potential next turn 
      // (though usually only one swap per person per round, but just in case)
      if (swapCommitted && !isMe) {
         setSwapCommitted(false);
      }
    }
  }, [game?.options?.swapState, game?.status, player.id, swapCommitted, isMyTurnToSwap, result]);

  // Team score calculation
  const teamScore = players
    .filter(p => p.team === player.team)
    .reduce((sum, p) => sum + p.score, 0);

  const teamNames: Record<string, string> = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' };
  const teamBgColors: Record<string, string> = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-green-500', YELLOW: 'bg-yellow-400' };

  const handleSubmit = (overrideAnswer?: string) => {
    const finalAnswer = (overrideAnswer || answer).trim();
    if (!finalAnswer) return;
    setSubmitted(true);
    onSubmit(finalAnswer);
  };

  useEffect(() => {
    setAnswer("");
    setBlankAnswers({});
    setSubmitted(false);
    setIsMyTurnToSwap(false);
    setSwapCommitted(false);
    setIsSwapExecuting(false);
    setActiveSwapperName(null);
    setSwapResultText(null);
    setPendingSwapTarget(null);
    // Sync timer with new question
    setTimeLeft(currentQuestion?.timeLimit || 20);

    // Aggressive auto-focus for the first blank
    if (game.status === 'PLAYING' && currentQuestion?.type === "BLANK") {
      const focus = () => {
        if (firstBlankRef.current) {
          firstBlankRef.current.focus();
          const val = firstBlankRef.current.value;
          firstBlankRef.current.value = "";
          firstBlankRef.current.value = val;
        }
      };

      // Try multiple times to ensure it hits after rendering
      focus();
      const t1 = setTimeout(focus, 50);
      const t2 = setTimeout(focus, 200);
      const t3 = setTimeout(focus, 500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [game.current_q_index, currentQuestion?.type, game.status]);

  useEffect(() => {
    if (game.status !== 'PLAYING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game.current_q_index, submitted, game.status]);

  // Maintain focus for BLANK questions
  useEffect(() => {
    if (game.status !== 'PLAYING' || currentQuestion?.type !== "BLANK" || submitted) return;
    
    const maintainFocus = () => {
      if (firstBlankRef.current && document.activeElement !== firstBlankRef.current) {
        firstBlankRef.current.focus();
      }
    };

    window.addEventListener('click', maintainFocus);
    window.addEventListener('touchstart', maintainFocus);
    return () => {
      window.removeEventListener('click', maintainFocus);
      window.removeEventListener('touchstart', maintainFocus);
    };
  }, [game.status, currentQuestion?.type, submitted]);

  useEffect(() => {
    // Round-specific unique key to prevent double trigger when 'result' updates (e.g., points calculation)
    const resultKey = `${game.id}_${game.current_q_index}`;
    if (game.status === 'RESULT' && result && result.is_correct && confettiTriggered.current !== resultKey) {
      confettiTriggered.current = resultKey;
      // USER REQUIREMENT: Delay confetti so result card is visible first
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#4f46e5", "#10b981", "#fbbf24"],
        });
      }, 500);
    }
  }, [result, game.id, game.current_q_index, game.status]);

  // Shield Block Broadcast Listener
  useEffect(() => {
    if (!game.id) return;

    const channel = supabase
      .channel(`game_events_student_${game.id}`)
      .on('broadcast', { event: 'SHIELD_BLOCK' }, (payload: any) => {
        setShieldBlock(payload.payload);
        // Auto hide after 4 seconds
        setTimeout(() => setShieldBlock(null), 4000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  if (game.status === "RESULT" && result) {
    const basePoints = currentQuestion?.points || 10;
    const eventStr = (result.event || 'none').toLowerCase();
    const isStrikeBonus = eventStr.includes('strike_bonus') || eventStr.includes('strike_double');
    const isDouble = eventStr.includes('double') || eventStr.includes('strike_double');
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in zoom-in duration-500 relative">
        {/* Original Style Card: White background with thick colored border */}
        <div className={cn(
          "w-full bg-white rounded-[4rem] border-[16px] shadow-2xl overflow-hidden flex flex-col items-center p-12 mb-10 transition-all duration-500 scale-105",
          result.is_correct ? "border-emerald-500" : "border-red-500"
        )}>
          {/* Central Icon Section */}
          <div className="mb-10 animate-pop">
            {result.is_correct ? (
              <div className="w-32 h-32 rounded-full border-[12px] border-red-500 flex items-center justify-center shadow-lg relative">
                 <div className="absolute inset-0 rounded-full border-4 border-white/30" />
              </div>
            ) : (
              <div className="w-32 h-32 flex items-center justify-center relative animate-pop">
                 <X className="text-red-500" size={120} strokeWidth={6} />
              </div>
            )}
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-slate-800 font-jua tracking-tighter mb-8">
            {result.is_correct ? "정답입니다!" : "아쉬워요!"}
          </h2>

          {/* Inset Point Card Section */}
          <div className="w-full bg-slate-50/50 rounded-[3.5rem] p-12 flex flex-col items-center shadow-inner border border-slate-100/50">
            <div className={cn(
              "text-8xl md:text-9xl font-black mb-2 tabular-nums tracking-tighter drop-shadow-sm",
              result.is_correct ? "text-indigo-600" : "text-red-500"
            )}>
              {(() => {
                const awarded = result.points_awarded;
                const eventStr = (result.event || 'none').toLowerCase();
                let multiplier = 1;
                if (eventStr.includes('strike_double')) multiplier = 4;
                else if (eventStr.includes('strike_bonus') || eventStr.includes('double')) multiplier = 2;
                
                const points = (awarded !== null && awarded !== undefined && awarded !== 0) 
                  ? awarded 
                  : (result.is_correct ? basePoints * multiplier : 0);
                return points >= 0 ? `+${points}점` : `${points}점`;
              })()}
            </div>
            
            <div className="flex flex-col items-center gap-2 text-center mt-6">
              {result.is_correct && result.q_index === game.current_q_index && (() => {
                const eventStr = (result.event || 'none').trim().toLowerCase();
                const isStrikeBonus = eventStr === 'strike_bonus' || eventStr === 'strike_double';
                const isDouble = eventStr === 'double' || eventStr === 'strike_double';
                
                return (
                  <div className="flex flex-col items-center gap-4">
                    {eventStr.split(',').map((e: string, idx: number) => {
                      const trimmedE = e.trim();
                      if (trimmedE === 'strike_bonus') return (
                        <div key={idx} className="bg-orange-50 border-2 border-orange-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3 animate-bounce">
                          <span className="text-2xl">⚡</span>
                          <span className="text-orange-600 font-black text-xl">스트라이크 효과로 이번 문제 점수 2배!</span>
                        </div>
                      );
                      if (trimmedE === 'double') return (
                        <div key={idx} className="bg-yellow-50 border-2 border-yellow-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3 animate-bounce">
                          <span className="bg-yellow-400 text-white px-3 py-1 rounded-xl font-black text-xl shadow-sm italic">X2</span>
                          <span className="text-yellow-600 font-black text-xl">점수 2배 효과로 이번 문제 점수 2배!</span>
                        </div>
                      );
                      if (trimmedE.startsWith('gift')) {
                        const donorName = trimmedE.includes(':') ? trimmedE.split(':')[1] : null;
                        return (
                          <div key={idx} className="bg-pink-50 border-2 border-pink-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3">
                            <Gift className="text-pink-500" size={24} fill="currentColor" />
                            <span className="text-pink-600 font-black text-xl font-jua">
                              {donorName ? `${donorName}님이 보낸 선물! 🎁` : "선물 받은 보너스 점수 포함! 🎁"}
                            </span>
                          </div>
                        );
                      }
                      if (trimmedE === 'strike') return (
                        <div key={idx} className="bg-blue-50 border-2 border-blue-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3 animate-pop">
                          <Zap className="text-blue-500" size={24} fill="currentColor" />
                          <span className="text-blue-600 font-black text-xl font-jua">스트라이크 효과 획득! ⚡</span>
                        </div>
                      );
                      if (trimmedE === 'swap') return (
                        <div key={idx} className="bg-indigo-50 border-2 border-indigo-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3 animate-pop">
                          <RefreshCw className="text-indigo-600 animate-spin-slow" size={28} />
                          <span className="text-indigo-700 font-black text-xl font-jua">점수 교체 효과 획득! 🔄</span>
                        </div>
                      );
                      if (trimmedE === 'shield') return (
                        <div key={idx} className="bg-cyan-50 border-2 border-cyan-100 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-3 animate-pop">
                          <Shield className="text-cyan-600" size={24} fill="currentColor" />
                          <span className="text-cyan-700 font-black text-xl font-jua">방패 아이템 획득! 🛡️</span>
                        </div>
                      );
                      return null;
                    })}
                  </div>
                );
              })()}

              {!result.is_correct && result.q_index === game.current_q_index && (
                <div className="flex flex-col items-center gap-2">
                  {result.event === 'cut' && <span className="text-red-500 font-black text-lg">✂️ 아이템 공격으로 감점되었습니다!</span>}
                  {result.event === 'donate' && <span className="text-indigo-500 font-black text-lg">🎁 친구들에게 점수를 나눠주었습니다! (-20)</span>}
                  {result.event?.endsWith('_blocked') && (
                    <span className="text-cyan-600 font-black flex items-center gap-2 bg-cyan-50 px-6 py-2 rounded-2xl border-2 border-cyan-200 shadow-sm">
                      <Shield size={20} fill="currentColor"/> 방패로 감점 공격을 막아냈습니다! 🛡️
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-slate-400 font-black text-2xl animate-pulse mb-12">
          {game?.status === 'RESULT' ? "다음 문제를 기다려주세요" : "곧 다음 문제가 시작됩니다"}
        </div>

        {/* --- SEQUENTIAL INTERACTIVE SWAP MODAL --- */}
        {((isMyTurnToSwap || activeSwapperName || swapCommitted) && game.status === 'RESULT') && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[900] flex items-center justify-center p-6 animate-in fade-in duration-500">
            {!isMyTurnToSwap && !swapResultText ? (
              /* Waiting State (Full Screen Popup) */
              <div className="flex flex-col items-center justify-center text-center max-w-lg w-full animate-pop">
                <div className="relative mb-12">
                   <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                   <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-indigo-400 relative z-10 animate-spin-slow">
                     <RefreshCw className="text-indigo-600" size={64} />
                  </div>
                </div>
                
                <h3 className="text-4xl md:text-5xl font-black text-white mb-6 font-jua tracking-tight leading-tight">
                  {activeSwapperName ? (
                    <>
                      <span className="text-yellow-300">{activeSwapperName}</span> 학생이 <br/>
                      점수 바꾸기를 하고 있어요!
                    </>
                  ) : (
                    <>
                      곧 <span className="text-yellow-300">내 차례</span>가 <br/>
                      시작됩니다!
                    </>
                  )}
                </h3>
                
                <div className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-[2.5rem] flex items-center gap-4 animate-pulse">
                   <div className="w-3 h-3 bg-green-400 rounded-full" />
                   <span className="text-indigo-100 font-bold text-xl">
                     {activeSwapperName ? "교체 결과 대기 중..." : "점수 교체 준비 중..."}
                   </span>
                </div>
                
                <p className="mt-10 text-indigo-200/60 font-medium text-lg max-w-md">
                   {activeSwapperName 
                     ? `${activeSwapperName} 학생이 대상을 고르고 있어요. 잠시만 기다려주세요!` 
                     : "획득한 점수 교체 효과를 곧 사용할 수 있습니다. 화면을 끄지 마세요!"}
                </p>
              </div>
            ) : (
              /* Selection or Result State */
              <div className="bg-white rounded-[3.5rem] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)] w-full max-w-xl overflow-hidden animate-in zoom-in duration-500 border-4 border-white relative">
                {/* Header Decoration */}
                <div className="p-10 bg-indigo-600 text-white flex flex-col items-center gap-4 relative">
                  <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10">
                     <RefreshCw size={200} className="absolute -top-20 -left-20 animate-spin-slow" />
                  </div>
                  
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30 shadow-xl">
                    <RefreshCw size={48} className={cn("text-white", !swapCommitted && !swapResultText && "animate-spin-slow")} />
                  </div>
                  
                  <h3 className="text-4xl font-black font-jua drop-shadow-md">점수 교체! 🔄</h3>
                  
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-indigo-100/80 font-bold text-lg">
                      {swapCommitted ? "교체가 마감되었습니다." : "누구와 점수를 바꿀까요?"}
                    </p>
                    {!swapCommitted && !swapResultText && (
                      <div className="bg-indigo-700/50 px-6 py-2 rounded-2xl border border-white/10 mt-2">
                        <span className="text-yellow-300 font-black">내 현재 점수: {player.score}점</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-8 max-h-[500px] overflow-y-auto custom-scrollbar bg-indigo-50/50">
                  {swapResultText ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-8 animate-in fade-in zoom-in duration-500 text-center px-6">
                      <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl">
                        <RefreshCw size={48} className="animate-spin-slow" />
                     </div>
                      <div className="text-3xl font-black text-slate-800 leading-tight font-jua">
                        {swapResultText}
                      </div>
                      {!isSwapExecuting ? (
                        <Button 
                          variant="primary" 
                          size="xl"
                          className="mt-4 rounded-[2rem] px-16 py-6 shadow-xl text-xl" 
                          onClick={() => {
                            setIsMyTurnToSwap(false);
                            setSwapResultText(null);
                          }}
                        >
                           확인
                        </Button>
                      ) : (
                        <div className="mt-8 flex flex-col items-center gap-2">
                           <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                           <p className="text-slate-400 font-medium">교정 정산 중... (잠시만 기다려주세요)</p>
                        </div>
                      )}
                    </div>
                  ) : pendingSwapTarget ? (
                    /* Target Confirmation Step */
                    <div className="py-12 flex flex-col items-center text-center gap-8 animate-in slide-in-from-bottom-4 duration-300">
                       <div className="relative group">
                          <div className={cn(
                            "w-32 h-32 rounded-[2.5rem] border-8 border-white shadow-2xl flex items-center justify-center text-5xl text-white font-black animate-pop",
                            pendingSwapTarget.team === 'RED' ? 'bg-red-500' :
                            pendingSwapTarget.team === 'BLUE' ? 'bg-blue-500' :
                            pendingSwapTarget.team === 'GREEN' ? 'bg-emerald-500' :
                            pendingSwapTarget.team === 'YELLOW' ? 'bg-yellow-400' : 'bg-indigo-500'
                          )}>
                            {pendingSwapTarget.nickname[0]}
                          </div>
                          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                             <Check size={24} strokeWidth={4} />
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <h4 className="text-3xl font-black text-slate-800">
                             <span className="text-indigo-600">{pendingSwapTarget.nickname}</span> 학생과 <br/>
                             점수를 바꾸시겠습니까?
                          </h4>
                          <p className="text-slate-400 font-bold">선택하면 즉시 점수가 교체됩니다.</p>
                       </div>
                       
                       <div className="flex gap-4 w-full">
                          <Button 
                            variant="ghost" 
                            size="xl" 
                            className="flex-1 py-6 rounded-3xl border-2 border-slate-200 text-slate-500 font-bold"
                            onClick={() => setPendingSwapTarget(null)}
                            disabled={isSwapExecuting}
                          >
                             취소
                          </Button>
                          <Button 
                            variant="primary" 
                            size="xl" 
                            className="flex-1 py-6 rounded-3xl shadow-lg text-xl"
                            onClick={() => handleSwapSelection(pendingSwapTarget.id, pendingSwapTarget.nickname)}
                            disabled={isSwapExecuting}
                          >
                             바꾸기!
                          </Button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {players
                          .filter(p => {
                            if (p.id === player.id) return false;
                            if (game.options?.isTeamMode && p.team === player.team) return false;
                            return true;
                          })
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .slice(0, 6) // Top 6
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => handleSwapSelection(p.id, p.nickname)}
                              className="w-full flex flex-col items-center gap-3 p-6 rounded-[2.5rem] border-4 border-white bg-white shadow-sm hover:shadow-xl hover:border-indigo-400 hover:-translate-y-1 transition-all active:scale-[0.95] group"
                            >
                              <div className={cn(
                                "w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-inner group-hover:scale-110 transition-transform",
                                p.team === 'RED' ? 'bg-red-500' :
                                p.team === 'BLUE' ? 'bg-blue-500' :
                                p.team === 'GREEN' ? 'bg-emerald-500' :
                                p.team === 'YELLOW' ? 'bg-yellow-400' : 'bg-indigo-500'
                              )}>
                                {p.nickname[0]}
                              </div>
                              <div className="flex flex-col items-center text-center">
                                <span className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors truncate w-full max-w-[120px]">
                                   {p.nickname}
                                </span>
                                <div className="bg-slate-100 px-3 py-1 rounded-full mt-1">
                                   <span className="text-xs font-black text-slate-500">{p.score}점</span>
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                      
                      {/* Skip Option */}
                      <div className="pt-4 mt-4 border-t-2 border-slate-100 border-dashed">
                        <Button
                          variant="ghost"
                          size="xl"
                          className="w-full py-6 rounded-[2rem] text-slate-400 font-bold hover:bg-slate-100 hover:text-slate-600 transition-all"
                          onClick={() => handleSwapSelection(null, null)}
                        >
                          바꾸지 않고 넘어가기
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Defensive check for missing currentQuestion
  if (!currentQuestion) {
    return (
      <div className="p-12 text-center text-indigo-400">
        <RefreshCw className="animate-spin mx-auto mb-4" size={48} />
        <p className="text-xl font-black">문제를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl animate-pop relative">
      {/* Shield Block Dynamic Animation Overlay */}
      {shieldBlock && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-indigo-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative bg-white rounded-[3rem] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-8 border-cyan-400 max-w-sm w-full animate-pop flex flex-col items-center">
             <div className="absolute -top-16 bg-cyan-400 text-white p-6 rounded-full shadow-xl border-8 border-white animate-bounce">
                <Shield size={64} fill="white" />
             </div>
             <div className="mt-8 text-center">
                <h4 className="text-3xl font-black text-indigo-900 mb-2">{shieldBlock.nickname} 학생이</h4>
                <div className="bg-indigo-50 px-6 py-4 rounded-2xl mb-4 border-2 border-indigo-100 flex items-center justify-center gap-2">
                   {shieldBlock.type === 'cut' ? <Scissors className="text-red-500 animate-pulse rotate-45" /> : <Gift className="text-pink-500 animate-pulse" />}
                   <span className="text-xl font-black text-indigo-600">
                     {shieldBlock.type === 'cut' ? '점수 삭감 공격' : '기부 요청'}을
                   </span>
                </div>
                <h3 className="text-4xl font-black text-cyan-600 animate-pulse">방어했습니다! 🛡️</h3>
             </div>
             
             {/* Clashing effect icons */}
             <div className="absolute inset-0 pointer-events-none">
                <Zap size={40} className="absolute top-1/4 left-1/4 text-yellow-400 animate-ping opacity-50" />
                <Zap size={30} className="absolute bottom-1/4 right-1/4 text-yellow-400 animate-ping opacity-50 delay-75" />
             </div>
          </div>
        </div>
      )}

      <div className={cn(
        "bg-white p-8 rounded-3xl shadow-2xl border-b-8 border-indigo-200 relative overflow-hidden",
        player.team === 'RED' && "ring-4 ring-inset ring-red-400/20",
        player.team === 'BLUE' && "ring-4 ring-inset ring-blue-400/20",
        player.team === 'GREEN' && "ring-4 ring-inset ring-green-400/20",
        player.team === 'YELLOW' && "ring-4 ring-inset ring-yellow-400/20"
      )}>

         {/* Team Identification Badge (Always visible during play) */}
        {player.team && (
          <div className={cn(
            "absolute -top-1 left-1/2 -translate-x-1/2 px-6 py-2 rounded-b-2xl text-white font-black text-xs shadow-md z-10 flex items-center gap-2",
            teamBgColors[player.team]
          )}>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {teamNames[player.team]} • 팀 점수: {teamScore.toLocaleString()}점
          </div>
        )}

        <div className="flex justify-between items-end mb-8 mt-2">
          <div className="flex flex-col gap-1">
             <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Question</span>
             <span className="bg-indigo-600 text-white px-5 py-1 rounded-2xl text-2xl font-black shadow-lg shadow-indigo-100">
               #{game.current_q_index + 1}
             </span>
          </div>

          <div className="flex flex-col items-center gap-1">
             <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Points</span>
             <span className="bg-emerald-500 text-white px-4 py-1 rounded-2xl text-xl font-black shadow-lg shadow-emerald-100">
               {currentQuestion?.points || 10}점
             </span>
          </div>
         
          <div className={cn(
            "flex flex-col items-end gap-1 transition-all duration-300",
            timeLeft <= 5 ? "text-red-500 scale-110" : "text-gray-400"
          )}>
             <span className="text-xs font-black uppercase tracking-widest">Time Remaining</span>
             <div className="flex items-center gap-3 font-black text-4xl">
               <Clock size={32} className={cn(timeLeft <= 5 && "animate-pulse")} />
               <span>{timeLeft}s</span>
             </div>
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-black text-gray-800 mb-10 break-keep leading-tight [&_p]:m-0 [&_p]:inline-block w-full">
          {currentQuestion?.type === "BLANK" ? (
            "다음 빈칸에 들어갈 알맞은 글자를 넣으세요." 
          ) : currentQuestion?.q ? (
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {processMathText(currentQuestion.q)}
            </ReactMarkdown>
          ) : (
            "문제를 불러오는 중..."
          )}
        </h2>

        {game.current_hint_stage > 0 && !submitted && timeLeft > 0 && currentQuestion?.type !== "OX" && currentQuestion?.type !== "MULTIPLE_CHOICE" && !currentQuestion?.math_mode && (
          <div className="mb-10 p-6 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 flex flex-col items-center animate-in slide-in-from-top-2 duration-300 shadow-inner">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={14} className="fill-indigo-400" /> 
              Teacher's Hint ({currentQuestion?.type !== "BLANK" && game.current_hint_stage === 1 ? '글자 수' : '초성 힌트'})
            </span>
            
            <div className="flex flex-col gap-6 w-full">
              {currentQuestion?.type === "BLANK" ? (
                // BLANK Type: Always show consonants for stage 1+
                <div className="flex flex-wrap gap-4 justify-center">
                  {currentQuestion.q.split(/\s+/).filter(Boolean).map((word: string, wordIdx: number) => {
                    const isBlank = currentQuestion.blanks?.includes(wordIdx);
                    if (!isBlank) return null;
                    return (
                      <div key={wordIdx} className="flex flex-col items-center gap-2">
                        {currentQuestion.blanks.length > 1 && (
                          <span className="text-[10px] font-black bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                            {currentQuestion.blanks.indexOf(wordIdx) + 1}번 빈칸 초성
                          </span>
                        )}
                        <div className="flex flex-wrap justify-center gap-2">
                          {word.split('').map((char: string, i: number) => (
                            <div 
                              key={i}
                              className="w-10 h-12 md:w-12 md:h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-indigo-200 scale-110 animate-pop"
                            >
                              {getChoseong(char)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Standard Type: Stage 1 = Length, Stage 2 = Consonants
                <div className="flex flex-wrap justify-center gap-3">
                  {currentQuestion?.a.split('').map((char: string, i: number) => {
                    const showChoseong = game.current_hint_stage >= 2;
                    const displayChar = showChoseong ? getChoseong(char) : (char === ' ' ? ' ' : '');
                    
                    return (
                      <div 
                        key={i}
                        className={cn(
                          "w-10 h-12 md:w-12 md:h-14 rounded-2xl flex items-center justify-center text-2xl font-black transition-all shadow-sm",
                          showChoseong && char !== ' '
                            ? "bg-indigo-600 text-white shadow-indigo-200 scale-110" 
                            : char === ' ' ? "bg-transparent border-none" : "bg-white text-indigo-200 border-2 border-indigo-100"
                        )}
                      >
                        {displayChar}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {(!submitted && timeLeft > 0) ? (
          <div className="space-y-6">
            {currentQuestion?.type === "MULTIPLE_CHOICE" && currentQuestion.options ? (
               <div className="grid grid-cols-2 gap-4">
                 {currentQuestion.options.map((opt: string, idx: number) => (
                   <Button
                     key={idx}
                     size="xl"
                     variant="ghost"
                     className="py-12 whitespace-normal break-keep text-2xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all font-black text-slate-700 border-2 flex items-center gap-3 [&_p]:m-0 [&_p]:inline"
                     onClick={() => {
                        setAnswer(opt);
                        setSubmitted(true);
                        onSubmit(opt);
                     }}
                   >
                     <span>{idx + 1}.</span>
                     <div className="flex-1 text-left">
                       <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                         {processMathText(opt)}
                       </ReactMarkdown>
                     </div>
                   </Button>
                 ))}
               </div>
            ) : currentQuestion?.type === "OX" ? (
               <div className="grid grid-cols-2 gap-6">
                 {["O", "X"].map(opt => (
                   <button
                     key={opt}
                     onClick={() => {
                        setAnswer(opt);
                        setSubmitted(true);
                        onSubmit(opt);
                     }}
                     className={cn(
                       "py-16 rounded-[2.5rem] border-4 font-black text-7xl transition-all shadow-xl",
                       opt === "O" ? "border-emerald-100 bg-emerald-50 text-emerald-500 hover:bg-emerald-100 hover:border-emerald-200" : "border-red-100 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-200"
                     )}
                   >
                     {opt}
                   </button>
                 ))}
               </div>
            ) : currentQuestion?.type === "BLANK" ? (
               <div className="space-y-6">
                 <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex flex-wrap gap-x-2 gap-y-8 items-center justify-center min-h-[160px]">
                    {currentQuestion.q.split(/\s+/).filter(Boolean).map((word: string, wordIdx: number) => {
                      const blanks = currentQuestion.blanks || [];
                      const blankIndex = blanks.indexOf(wordIdx);
                      const isBlank = blankIndex !== -1;
                      
                      if (isBlank) {
                        const wordLen = word.length;
                        return (
                          <div key={wordIdx} className="relative group w-fit">
                            <SegmentedInput
                              value={blankAnswers[wordIdx] || ""}
                              length={word.length}
                              onChange={(val) => {
                                setBlankAnswers(prev => {
                                  const next = { ...prev, [wordIdx]: val };
                                  const sortedBlanks = [...blanks].sort((a, b) => a - b);
                                  const combined = sortedBlanks.map(idx => next[idx] || "").join(", ");
                                  setAnswer(combined);
                                  return next;
                                });
                              }}
                              onEnter={() => handleSubmit()}
                              autoFocus={blankIndex === 0}
                              firstRef={blankIndex === 0 ? firstBlankRef : null}
                            />

                            {blanks.length > 1 && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                {blankIndex + 1}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return <span key={wordIdx} className="text-2xl font-black text-slate-400 px-1">{word}</span>;
                    })}
                 </div>
                 <Button 
                    size="xl" 
                    className="w-full py-8 text-3xl shadow-indigo-200 shadow-lg"
                    onClick={() => handleSubmit()}
                  >
                    제출하기!
                  </Button>
               </div>
            ) : (
               <>
                  <div className="w-full border-4 border-gray-100 rounded-2xl focus-within:border-indigo-400 bg-white transition-all overflow-hidden relative">
                    {currentQuestion?.math_mode ? (
                      <MathInput
                        value={answer}
                        onChange={(val) => setAnswer(val)}
                        onEnter={() => handleSubmit(answer)}
                        className="w-full p-2 text-center text-3xl font-bold bg-transparent"
                        placeholder="정답을 입력하세요"
                        template={currentQuestion?.template}
                      />
                    ) : (
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit(answer)}
                        className="w-full p-6 text-center text-3xl font-bold bg-transparent outline-none"
                        placeholder="정답을 입력하세요"
                        autoFocus
                      />
                    )}
                  </div>
                  <Button 
                    size="xl" 
                    className="w-full py-8 text-3xl shadow-indigo-200 shadow-lg"
                    onClick={() => handleSubmit()}
                  >
                    제출하기!
                  </Button>
               </>
            )}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center gap-4 text-indigo-400 animate-pulse">
            <div className="text-8xl">
              {timeLeft === 0 && !submitted ? "⏰" : 
               timeLeft === 0 && submitted ? "⌛" : "🤔"}
            </div>
            <p className="text-2xl font-black">
              {timeLeft === 0 && !submitted ? "시간이 종료되었습니다!" : 
               timeLeft === 0 && submitted ? "시간 종료! 결과를 기다려주세요..." : "선생님이 정답을 확인 중입니다..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
