"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/DialogProvider';
import { cn } from '@/lib/utils';
import { 
  Trophy, Clock, Check, X, RefreshCw, Zap, Gift, 
  Shield, TrendingUp, ChevronLeft, ChevronRight, Scissors, Keyboard, Layers,
  User, HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MathInput } from '@/components/ui/MathInput';
import { SegmentedInput } from '@/components/game/SegmentedInput';

interface GameDisplayProps {
  game: any;
  player: any;
  players: any[];
  onSubmit: (answer: string) => void;
  refresh: () => void;
  result?: any;
  onRetract?: () => void;
}

function getChoseong(str: string) {
  const choseong = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) result += choseong[Math.floor(code / 588)];
    else result += str.charAt(i);
  }
  return result;
}

const processMathText = (text: string) => {
  if (!text) return "";
  let processed = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  return processed;
};

export function GameDisplay({ game, player, players, onSubmit, refresh, result, onRetract }: GameDisplayProps) {
  const { showConfirm } = useDialog();
  const [answer, setAnswer] = useState("");
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [internalSubmitted, setInternalSubmitted] = useState(false);
  const [showScoreTab, setShowScoreTab] = useState(false);
  const [showHelpTab, setShowHelpTab] = useState(false);
  const [rankingTab, setRankingTab] = useState<'individual' | 'team'>('individual');
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const [hintStage, setHintStage] = useState<number>(game.current_hint_stage || 0);

  const totalQuestions = game.options?.questions?.length || 0;
  const currentQuestion = game.options?.questions[game.current_q_index];
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const helpSidebarRef = useRef<HTMLDivElement>(null);
  const firstBlankRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const [isMyTurnToSwap, setIsMyTurnToSwap] = useState(false);
  const [swapCommitted, setSwapCommitted] = useState(false);
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);
  const [activeSwapperName, setActiveSwapperName] = useState<string | null>(null);
  const [swapResultText, setSwapResultText] = useState<string | null>(null);
  const [pendingSwapTarget, setPendingSwapTarget] = useState<any>(null);
  const prevQIndexRef = useRef<number>(game.current_q_index);

  const handleSwapSelection = async (targetId: string | null, targetName: string | null) => {
    if (isSwapExecuting || !isMyTurnToSwap) return;
    
    if (targetId && !pendingSwapTarget) {
      const target = players.find((p: any) => p.id === targetId);
      setPendingSwapTarget(target);
      return;
    }

    setIsSwapExecuting(true);
    setPendingSwapTarget(null);
    
    try {
      // 1. Mark as done in DB first
      if (result?.id) {
         const newEvent = (result.event || "")
           .split(',')
           .map((e: string) => e.trim() === 'swap' ? 'swap_done' : e)
           .join(',');
         await supabase.from('answers').update({ event: newEvent }).eq('id', result.id);
      }

      // 2. Use the existing component-level channel for broadcasting
      if (channelRef.current) {
        console.log(`[Swap] Broadcasting EXECUTE_SWAP to target: ${targetId}`);
        await channelRef.current.send({
          type: 'broadcast',
          event: 'EXECUTE_SWAP',
          payload: { swapperId: player.id, targetId }
        });
      } else {
        console.warn("[Swap] channelRef.current is not available for broadcasting");
        // Fallback: create a temporary channel if needed, but this shouldn't happen
      }

      if (targetId) {
        setSwapResultText(`${targetName} 학생과 점수를 바꿨습니다!`);
      } else {
        setSwapResultText(`점수 바꾸기를 하지 않고 넘어갔습니다.`);
      }
    } catch (err) {
      console.error("Swap execution failed:", err);
      setIsSwapExecuting(false);
    }
    // Safety clearing if host doesn't respond within 7s
    setTimeout(() => { 
      if (isSwapExecuting) setIsSwapExecuting(false); 
    }, 7000);
  };

  useEffect(() => {
    if (!game?.id || !player.id) return;

    // Sync swap state from game options
    const swapState = game.options?.swapState;
    if ((game.status === 'RESULT' || game.status === 'PLAYING') && swapState && swapState.currentSwapperId) {
      const currentSwapperId = String(swapState.currentSwapperId);
      const isMe = currentSwapperId === String(player.id);
      
      setActiveSwapperName(swapState.currentSwapperNickname);
      setIsMyTurnToSwap(isMe);
      
      // If the current swapper is someone else, make sure I don't have 'executing' state active
      if (!isMe && isSwapExecuting) {
        setIsSwapExecuting(false);
      }
    } else {
      setActiveSwapperName(null);
      setIsMyTurnToSwap(false);
      setIsSwapExecuting(false);
    }

    if (game.current_hint_stage !== undefined) {
      setHintStage(game.current_hint_stage);
    }

    // Force clear results/pending states when moving to a new question or status changes away from RESULT
    if (game.status === 'PLAYING' || game.status === 'WAITING' || (prevQIndexRef.current !== -1 && prevQIndexRef.current !== game.current_q_index)) {
      setSwapResultText(null);
      setPendingSwapTarget(null);
      setIsSwapExecuting(false);
    }
    prevQIndexRef.current = game.current_q_index;
  }, [game.status, game.options?.swapState, game.current_hint_stage, game.current_q_index, player.id]);

  useEffect(() => {
    if (!game?.id || !player.id) return;

    const channel = supabase.channel(`game_events_${game.id}`)
      .on('broadcast', { event: 'START_SWAP' }, ({ payload }: { payload: { playerId: string; nickname: string } }) => {
        console.log("[Student] START_SWAP received for:", payload.nickname);
        setActiveSwapperName(payload.nickname);
        if (String(payload.playerId) === String(player.id)) {
          setIsMyTurnToSwap(true);
          setSwapResultText(null);
          // Only auto-open if not already open to avoid disruption
          setShowScoreTab(true);
        } else {
          setIsMyTurnToSwap(false);
        }
      })
      .on('broadcast', { event: 'SWAP_COMPLETED' }, ({ payload }: { payload: { swapperId: string; targetId: string; skipped: boolean; targetName: string; swapperName: string } }) => {
        const { swapperId, targetId, skipped, targetName, swapperName } = payload;
        setActiveSwapperName(null);
        setIsSwapExecuting(false);
        
        if (String(swapperId) === String(player.id)) {
          setIsMyTurnToSwap(false);
          setSwapCommitted(true);
          if (skipped) setSwapResultText("점수 바꾸기를 하지 않고 넘어갔습니다.");
          else {
            setSwapResultText(`${targetName} 학생과 점수를 바꿨습니다!`);
            confetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
          }
        } else if (targetId === player.id && !skipped) {
          setSwapResultText(`${swapperName} 학생이 당신과 점수를 바꿨습니다!`);
        }
      })
      .on('broadcast', { event: 'TIMER_SYNC' }, ({ payload }: { payload: any }) => {
        setTimeLeft(payload.timeLeft);
      })
      .on('broadcast', { event: 'HINT_REVEAL' }, ({ payload }: { payload: any }) => {
        setHintStage(payload.stage);
      })
      .subscribe();
    
    channelRef.current = channel;

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [game?.id, player.id]); // Removed UI tab dependencies

  // Separate effect for outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showScoreTab && sidebarRef.current && !sidebarRef.current.contains(target)) setShowScoreTab(false);
      if (showHelpTab && helpSidebarRef.current && !helpSidebarRef.current.contains(target)) setShowHelpTab(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showScoreTab, showHelpTab]);

  useEffect(() => {
    if (result) {
      if (result.answer === "(retracted)") {
        setSubmitted(false);
        setInternalSubmitted(false);
        setAnswer("");
      } else {
        setSubmitted(true);
        setInternalSubmitted(true);
        setAnswer(result.answer || "");
        if (currentQuestion?.type === "BLANK" && result.answer) {
          const parts = result.answer.split(", ");
          const newBlanks: Record<number, string> = {};
          const blanks = currentQuestion.blanks || [];
          blanks.sort((a: number, b: number) => a - b).forEach((idx: number, i: number) => {
            if (parts[i]) newBlanks[idx] = parts[i];
          });
          setBlankAnswers(newBlanks);
        }
      }
    } else {
      setSubmitted(false);
      setInternalSubmitted(false);
      setAnswer("");
      setBlankAnswers({});
    }
  }, [result, game.current_q_index, currentQuestion]);

  // Backup sync for Swap: Monitor game options in case broadcast is missed
  useEffect(() => {
    if (game?.status === 'RESULT' && game?.options?.swapState?.currentSwapperId !== player.id) {
      if (isSwapExecuting) {
        console.log("[Game] Clearing stuck executing state based on swapState");
        setIsSwapExecuting(false);
      }
    }
    if (game?.status === 'RESULT' && game?.options?.swapState?.currentSwapperId === player.id) {
      if (!isMyTurnToSwap && !isSwapExecuting) {
        console.log("[Game] State-based swap trigger activated for:", player.nickname);
        setIsMyTurnToSwap(true);
        setShowScoreTab(true);
      }
    }
  }, [game?.options?.swapState?.currentSwapperId, game?.status, player.id, isMyTurnToSwap, isSwapExecuting, player.nickname]);

  const [timeLeft, setTimeLeft] = useState<number>(currentQuestion?.timeLimit || 20);

  useEffect(() => {
    if (game?.status === 'PLAYING' && game?.options?.current_q_started_at) {
      const startTime = new Date(game.options.current_q_started_at).getTime();
      let limit = (currentQuestion?.timeLimit || 20);
      const limitMs = limit * 1000;
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(0, Math.ceil((limitMs - elapsed) / 1000));
        setTimeLeft(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 500);
      return () => clearInterval(interval);
    }
  }, [game?.status, game?.options?.current_q_started_at, game?.current_q_index, currentQuestion?.timeLimit]);

  const getQuestionFontSize = (text: string) => {
    const len = text.length;
    if (len > 120) return "text-lg md:text-xl";
    if (len > 60) return "text-xl md:text-3xl";
    return "text-3xl md:text-4xl";
  };

  const getOptionFontSize = (text: string) => {
    const len = text.length;
    if (len > 40) return "text-sm md:text-base";
    if (len > 25) return "text-base md:text-lg";
    return "text-lg md:text-2xl";
  };

  const handleAnswerChange = (val: string) => {
    setAnswer(val);
  };

  const handleBlankChange = (wordIdx: number, val: string, blanks: number[]) => {
    setBlankAnswers((prev: Record<number, string>) => {
      const next = { ...prev, [wordIdx]: val };
      const sortedBlanks = [...blanks].sort((a, b) => a - b);
      setAnswer(sortedBlanks.map(idx => next[idx] || "").join(", "));
      return next;
    });
  };

  const isTimeOut = timeLeft === 0;

  const handleSubmit = (finalAnswer?: string) => {
    if (submitted || isTimeOut) return;
    const ans = (finalAnswer !== undefined ? finalAnswer : answer).trim();
    if (!ans) return;
    setSubmitted(true);
    setInternalSubmitted(true);
    onSubmit(ans);
  };

  const handleRetractClick = async () => {
    if (activeSwapperName) return; // Prevent retraction during swap
    const confirmed = await showConfirm({
      message: "답안을 수정하시겠습니까?",
      description: "수정 버튼을 누르면 현재 제출된 정답이 무효화되고 다시 입력할 수 있습니다.",
      confirmLabel: "수정하기", 
      cancelLabel: "취소"
    });
    if (confirmed && onRetract) {
      onRetract();
      setSubmitted(false);
      setInternalSubmitted(false);
    }
  };

  const getEventInfo = (eventCode: string) => {
    if (!eventCode || eventCode === 'none') return null;
    const e = eventCode.trim().toLowerCase();
    
    if (e.startsWith('speed:')) {
      const points = e.split(':')[1];
      return { icon: '🚀', text: `빠른 제출 (+${points})`, color: 'bg-cyan-500', desc: `빠른 정답 보너스입니다!` };
    }
    if (e.startsWith('streak:')) {
      const parts = e.split(':');
      const count = parts[1];
      const points = parts[2];
      return { icon: '🔥', text: `${count}연속 정답! (+${points})`, color: 'bg-orange-600', desc: `연속 정답 보너스입니다!` };
    }

    if (e === 'double') return { icon: '✨', text: '두배 찬스!', color: 'bg-yellow-400', desc: '다음 문제 점수가 2배가 됩니다!' };
    if (e === 'shield') return { icon: '🛡️', text: '방어막 획득!', color: 'bg-blue-400', desc: '공격을 1회 방어합니다!' };
    if (e === 'swap') return { icon: '🔄', text: '점수 바꾸기!', color: 'bg-indigo-500', desc: '다른 친구와 점수를 바꿀 수 있습니다!' };
    if (e === 'swap_done') return { icon: '✅', text: '교체 완료!', color: 'bg-emerald-500', desc: '점수 교체 기회를 사용했습니다.' };
    if (e === 'strike') return { icon: '⚡', text: '스트라이크!', color: 'bg-amber-400', desc: '다음 문제 정답 시 보너스 점수!' };
    if (e === 'cut') return { icon: '✂️', text: '점수 삭감!', color: 'bg-red-500', desc: '상대방의 점수를 깎았습니다!' };
    if (e === 'donate') return { icon: '📤', text: '점수 기부!', color: 'bg-emerald-500', desc: '다른 친구들에게 점수를 나누어 주었습니다!' };
    if (e.startsWith('gift')) {
      const donor = e.split(':')[1] || '누군가';
      return { icon: '🎁', text: '점수 선물!', color: 'bg-pink-400', desc: `${donor} 학생이 점수를 선물했습니다!` };
    }
    if (e.endsWith('_blocked')) return { icon: '🛡️', text: '공격 방어!', color: 'bg-slate-500', desc: '방어막으로 공격을 막았습니다!' };
    return null;
  };

  const eventInfos = (result?.event || "").split(',').map(getEventInfo).filter(Boolean);

  const helpSections = React.useMemo(() => {
    const opts = game.options || {};
    const probs = opts.probabilities || { double: 5, swap: 5, strike: 5, shield: 5, cut: 5, donate: 5 };
    
    const sections = [
      { 
        title: "🎮 게임 시스템", 
        items: [
          { icon: "🎁", label: "행운의 뽑기", desc: `정답을 맞히면 ${game.options?.luckyProb || 40}% 확률로 행운의 아이템을 얻거나, 오답일 경우 ${game.options?.unluckyProb || 20}% 확률로 불운의 효과가 발생합니다.` },
          { icon: "✅", label: "정답 제출", desc: "문제를 맞히면 기본 점수를 획득합니다." },
          { icon: "🚀", label: "스피드 보너스", desc: "빠르게 맞힌 선착순 3명에게 추가 점수(+5, +3, +1)를 드립니다." },
          { icon: "🔥", label: "콤보 보너스", desc: "연속해서 맞히면 더 큰 점수를 얻습니다! (3/5/10연속)" }
        ]
      }
    ];

    const luckyItems = [];
    if (opts.double !== false) luckyItems.push({ icon: "✨", label: "2배 찬스", desc: `이번 문제 점수를 2배로 받습니다. (확률: ${probs.double}%)` });
    if (opts.swap !== false) luckyItems.push({ icon: "🔄", label: "점수 바꾸기", desc: `나보다 점수 높은 사람과 내 점수를 바꿉니다. (확률: ${probs.swap}%)` });
    if (opts.strike !== false) luckyItems.push({ icon: "⚡", label: "스트라이크", desc: `다음 문제를 맞히면 점수가 2배가 됩니다. (확률: ${probs.strike}%)` });
    if (opts.shield !== false) luckyItems.push({ icon: "🛡️", label: "방어막", desc: `상대방의 점수 삭감/기부 공격을 자동으로 1회 방어합니다. (확률: ${probs.shield}%)` });

    if (luckyItems.length > 0) {
      sections.push({ title: "🍀 행운의 아이템 (정답 시)", items: luckyItems });
    }

    const unluckyItems = [];
    if (opts.cut !== false) unluckyItems.push({ icon: "✂️", label: "점수 삭감", desc: `내 점수에서 문제 배점만큼 깎입니다. (확률: ${probs.cut}%)` });
    if (opts.donate !== false) unluckyItems.push({ icon: "📤", label: "점수 기부", desc: `내 점수 중 최대 50점을 다른 정답자들에게 나눠줍니다. (확률: ${probs.donate}%)` });

    if (unluckyItems.length > 0) {
      sections.push({ title: "👿 불운의 효과 (오답 시)", items: unluckyItems });
    }

    return sections;
  }, [game.options]);

  return (
    <>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-3 md:p-6 overflow-hidden">
      {/* Main Content Area */}
      {game.status === 'RESULT' && result ? (
        <div className="flex flex-col items-center justify-center min-h-[600px] w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 relative">
          
          {/* Waiting Overlay for Score Swap */}
          {activeSwapperName && !isMyTurnToSwap && !isSwapExecuting && (
            <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500 text-center p-8">
                <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-8 border-indigo-500 max-w-sm w-full scale-110">
                    <div className="relative mb-6">
                        <RefreshCw className="text-indigo-600 animate-spin mx-auto opacity-20" size={80} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full animate-ping opacity-75" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl text-indigo-600">🔄</span>
                            </div>
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-indigo-900 mb-2">{activeSwapperName} 학생이</h3>
                    <p className="text-xl font-black text-indigo-600">점수 바꾸기를 진행 중입니다!</p>
                    <div className="mt-8 flex justify-center gap-1.5">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" />
                    </div>
                    <p className="text-slate-400 text-xs font-bold mt-6 tracking-tighter">잠시만 기다려 주세요 정산 완료 후 이동합니다.</p>
                </div>
            </div>
          )}
          {/* Swap Selection Modal (for Swapper) */}
          {(swapResultText || pendingSwapTarget || isMyTurnToSwap) && (
             <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300 border-8 border-indigo-500 flex flex-col items-center text-center">
                   {swapResultText ? (
                      <>
                         <div className="text-5xl mb-4">✨</div>
                         <h3 className="text-2xl font-black text-indigo-900 mb-4">{swapResultText}</h3>
                         <Button size="lg" className="w-full rounded-2xl bg-indigo-600" onClick={() => { setSwapResultText(null); if (swapCommitted) refresh(); }}>확인</Button>
                      </>
                   ) : pendingSwapTarget ? (
                      <>
                         <div className="text-5xl mb-4">🔄</div>
                         <h3 className="text-2xl font-black text-indigo-900 mb-2">{pendingSwapTarget.nickname} 학생과<br/>점수를 바꿀까요?</h3>
                         <div className="flex gap-3 w-full mt-6">
                            <Button size="lg" className="flex-1 rounded-2xl bg-indigo-600" onClick={() => handleSwapSelection(pendingSwapTarget.id, pendingSwapTarget.nickname)}>바꾸기</Button>
                            <Button size="lg" variant="ghost" className="flex-1 rounded-2xl border-2" onClick={() => setPendingSwapTarget(null)}>취소</Button>
                         </div>
                      </>
                   ) : isMyTurnToSwap ? (
                      <div className="w-full flex flex-col items-center max-h-[85vh]">
                          <div className="text-4xl mb-4">🔄</div>
                          <h3 className="text-2xl font-black text-indigo-900 mb-1">점수 바꾸기!</h3>
                          <div className="px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100 mb-4 animate-pulse">
                             <span className="text-xs font-black text-indigo-600 tracking-tight">나의 현재 점수: <span className="text-sm">{(player.score || 0).toLocaleString()}</span>점</span>
                          </div>
                          <p className="text-slate-500 font-bold mb-4">누구와 점수를 바꿀까요?</p>
                          <div className="w-full overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4" style={{ maxHeight: 'calc(80vh - 350px)', minHeight: '120px' }}>
                             {players.filter(p => String(p.id) !== String(player.id)).sort((a,b) => (b.score||0)-(a.score||0)).map(p => (
                                <button key={p.id} onClick={() => handleSwapSelection(p.id, p.nickname)} className="w-full flex items-center justify-between p-3 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200"><img src={`/avatars/avatar_${p.avatar_id || 1}.png`} alt="avatar" className="w-full h-full object-cover" /></div>
                                      <span className="font-bold text-slate-700">{p.nickname}</span>
                                   </div>
                                   <span className="font-black text-indigo-600">{(p.score || 0).toLocaleString()}점</span>
                                </button>
                             ))}
                          </div>
                          <Button variant="ghost" className="w-full rounded-2xl border-2 border-slate-100 py-4" onClick={() => handleSwapSelection(null, null)}>넘어가기 (선택 안함)</Button>
                       </div>
                   ) : null}
                </div>
             </div>
          )}

          <div className={cn(
            "w-full bg-white rounded-[4rem] border-[16px] shadow-2xl overflow-hidden flex flex-col items-center p-8 transition-all duration-500 scale-105",
            result.is_correct ? "border-emerald-500" : "border-red-500"
          )}>
            <div className="text-xl md:text-2xl font-black text-slate-800 mb-4">{result.is_correct ? "정답입니다!" : "아쉬워요!"}</div>
            <div className="mb-6 flex flex-col items-center gap-4">
              {result.is_correct ? <div className="p-4 bg-emerald-50 rounded-full"><Check className="text-emerald-500" size={80} strokeWidth={8} /></div> : <div className="p-4 bg-red-50 rounded-full"><X className="text-red-500" size={100} strokeWidth={6} /></div>}
              {eventInfos.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {eventInfos.map((info: any, idx: number) => (
                    <div key={idx} className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl text-white font-black animate-bounce shadow-lg", info?.color)}>
                      <span className="text-xl">{info?.icon}</span>
                      <span className="text-sm">{info?.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-slate-50 rounded-[3rem] p-8 w-full flex flex-col items-center">
              <div className={cn("text-6xl md:text-8xl font-black mb-2", result.is_correct ? "text-indigo-600" : "text-red-500")}>
                {result.points_added || result.points_awarded || 0}점
              </div>
              <div className="grid grid-cols-2 gap-4 w-full mt-4">
                <div className="bg-white p-3 rounded-2xl border text-center">
                  <div className="text-[10px] text-slate-400 font-black uppercase">내가 쓴 답</div>
                  <div className="font-bold truncate">{answer || "(없음)"}</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-indigo-100 text-center">
                  <div className="text-[10px] text-indigo-400 font-black uppercase">정답</div>
                  <div className="font-bold text-indigo-600 truncate">{currentQuestion?.a}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl p-3 md:p-6 flex flex-col relative overflow-hidden h-full max-h-[94vh] focus-within:ring-0">
          <div className="flex items-center justify-between mb-1 px-2 pt-0.5">
            <div className="bg-indigo-50 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-indigo-100">
              <Trophy size={16} className="text-indigo-500" />
              <span className="text-lg md:text-xl font-black text-indigo-600">Q{(game?.current_q_index ?? 0) + 1}</span>
              <span className="text-xs font-bold text-indigo-300">/ {totalQuestions}</span>
            </div>
            <div className={cn("px-3 py-1.5 rounded-xl flex items-center gap-2 border-2 transition-all", timeLeft <= 5 ? "bg-red-50 border-red-200 animate-pulse" : "bg-slate-50 border-slate-100")}>
              <Clock size={16} className={timeLeft <= 5 ? "text-red-500" : "text-slate-400"} />
              <span className={cn("text-lg md:text-2xl font-black tabular-nums", timeLeft <= 5 ? "text-red-600" : "text-slate-600")}>{timeLeft}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-2">
            {hintStage > 0 && currentQuestion.type !== "BLANK" && (
              <div className="mb-4 flex flex-col items-center gap-1">
                 <div className="flex flex-wrap justify-center gap-1.5 animate-in fade-in zoom-in duration-500">
                    {currentQuestion.a.split('').map((char: string, idx: number) => {
                      const isSpace = /\s/.test(char);
                      if (isSpace) return <div key={idx} className="w-2" />;
                      const choseong = getChoseong(char);
                      const showChoseong = hintStage >= 2;
                      return (
                        <div key={idx} className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm",
                          showChoseong ? "bg-white border-2 border-indigo-400 text-indigo-600 shadow-sm" : "bg-indigo-50 border border-indigo-100 text-indigo-200"
                        )}>{showChoseong ? choseong : "?"}</div>
                      );
                    })}
                 </div>
                  <span className="text-[8px] md:text-[9px] text-indigo-400 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">{hintStage >= 2 ? "초성 힌트 공개" : "글자수 힌트 공개"}</span>
              </div>
            )}

            <div className={cn("font-black text-slate-800 break-keep leading-tight text-center py-1 md:py-2", getQuestionFontSize(currentQuestion.q))}>
              {currentQuestion.type === "BLANK" ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-indigo-600 font-black text-sm md:text-base bg-indigo-50/50 px-4 py-1.5 rounded-full border border-indigo-100 animate-pulse">
                       💡 빈칸에 알맞은 단어를 입력해 주세요!
                    </div>
                  </div>
              ) : (
                 <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{processMathText(currentQuestion.q)}</ReactMarkdown>
              )}
            </div>
            {currentQuestion.image_url && <img src={currentQuestion.image_url} alt="q" className="rounded-2xl max-w-full max-h-[35vh] object-contain mx-auto shadow-lg border-2 border-slate-100 mb-2" />}
            
            <div className="space-y-2 flex flex-col flex-1">
              {(submitted || internalSubmitted) ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-indigo-50/50 rounded-[2.5rem] border-2 border-indigo-100 border-dashed animate-in zoom-in relative">
                  <div className="text-4xl md:text-6xl mb-4 animate-bounce">✨</div>
                  <h3 className="text-2xl md:text-3xl font-black text-indigo-900 mb-2 italic">정답 제출 완료!</h3>
                  <p className="text-slate-500 font-bold text-center">우와! 정답을 잘 제출했어요. <br/>다른 친구들이 문제를 다 풀 때까지 우리 조금만 기다려 볼까요? 😊</p>
                  {!isTimeOut && !activeSwapperName && (
                    <button onClick={handleRetractClick} className="mt-8 px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-200 rounded-2xl font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"><RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" /> 다시 고치기</button>
                  )}
                </div>
              ) : isTimeOut ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-indigo-400 animate-pulse"><div className="text-7xl">⌛</div><p className="text-2xl font-black">시간 종료!</p></div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 border-t-2 border-slate-100 pt-4">
                  {currentQuestion.type === "MULTIPLE_CHOICE" ? (
                    <div className="grid grid-cols-2 gap-3 md:gap-4 h-full">
                      {currentQuestion.options.map((opt: string, idx: number) => (
                        <Button key={idx} size="xl" variant="ghost" className={cn("py-6 md:py-8 h-full whitespace-normal break-keep font-black border-2 flex items-center gap-3", getOptionFontSize(opt))} onClick={() => handleSubmit(opt)}>
                          <span className="shrink-0">{idx + 1}.</span>
                          <div className="flex-1 text-left"><ReactMarkdown components={{ p: 'span' }}>{processMathText(opt)}</ReactMarkdown></div>
                        </Button>
                      ))}
                    </div>
                  ) : currentQuestion.type === "OX" ? (
                    <div className="grid grid-cols-2 gap-4 h-full py-4">
                      {["O", "X"].map(opt => (
                        <button key={opt} onClick={() => handleSubmit(opt)} className={cn("flex-1 rounded-[2.5rem] border-4 font-black text-7xl transition-all shadow-xl flex items-center justify-center", opt === "O" ? "bg-emerald-50 text-emerald-500 border-emerald-100 hover:bg-emerald-100" : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100")}>{opt}</button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 flex flex-col flex-1">
                      {currentQuestion.type === "BLANK" ? (
                        <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex flex-wrap gap-2 md:gap-4 items-center justify-center min-h-[100px] overflow-y-auto">
                          {currentQuestion.q.split(/\s+/).filter(Boolean).map((word: string, wordIdx: number) => {
                            const blanks = currentQuestion.blanks || [];
                            const bIdx = blanks.indexOf(wordIdx);
                            if (bIdx !== -1) {
                              const choseongHint = (hintStage >= 2) ? getChoseong(word) : undefined;
                              return (
                                <SegmentedInput key={wordIdx} value={blankAnswers[wordIdx] || ""} length={word.length} hint={choseongHint} onChange={(val) => handleBlankChange(wordIdx, val, blanks)} onEnter={() => handleSubmit()} autoFocus={bIdx === 0} firstRef={bIdx === 0 ? firstBlankRef : undefined} />
                              );
                            }
                            return <span key={wordIdx} className="text-xl md:text-2xl font-black text-slate-400">{word}</span>;
                          })}
                        </div>
                      ) : (
                        <div className="w-full">
                           <MathInput value={answer} onChange={handleAnswerChange} onEnter={() => handleSubmit()} className="w-full text-lg md:text-xl font-bold p-1" template={currentQuestion.template} focusOnMount={true} isFirstQuestion={game.current_q_index === 0} gameId={game.id} />
                        </div>
                      )}
                      <Button size="xl" className="w-full py-5 md:py-6 text-xl md:text-2xl shadow-lg mt-auto" onClick={() => handleSubmit()}>정답 제출하기</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Floating UI Elements (Persistent Sidebars as Slide-out Drawers) */}
      
      <div 
        ref={sidebarRef}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-[200] transition-all duration-500 ease-out flex items-center group",
          showScoreTab ? "translate-x-0" : "translate-x-[calc(100%-48px)]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => { setShowScoreTab(!showScoreTab); setShowHelpTab(false); }} 
          className={cn(
            "w-12 h-28 flex flex-col items-center justify-center gap-2 rounded-l-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.1)] transition-all",
            showScoreTab ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 hover:bg-indigo-50 border-y-2 border-l-2 border-indigo-100"
          )}
        >
          <Trophy size={20} className={cn(showScoreTab && "animate-bounce")} />
          <span className="text-[10px] font-black [writing-mode:vertical-lr] tracking-tighter">RANKING</span>
          {showScoreTab ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div className="w-72 md:w-80 h-[70vh] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.15)] border-l-4 border-indigo-500/10 p-5 flex flex-col">
          <div className="flex items-center justify-between border-b-2 border-slate-50 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 rounded-lg"><Trophy size={16} className="text-indigo-600" /></div>
              <h3 className="font-black text-slate-800">실시간 순위</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live</span>
            </div>
          </div>
          
          {game?.options?.isTeamMode && (
            <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-2xl">
              <button onClick={() => setRankingTab('individual')} className={cn("flex-1 py-2 text-[11px] font-black rounded-xl transition-all", rankingTab === 'individual' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>개인별</button>
              <button onClick={() => setRankingTab('team')} className={cn("flex-1 py-2 text-[11px] font-black rounded-xl transition-all", rankingTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>팀별</button>
            </div>
          )}
          
          <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {rankingTab === 'individual' ? (
              [...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i: number) => (
                <div key={p.id} className={cn(
                  "flex justify-between items-center p-3 rounded-2xl border transition-all animate-in slide-in-from-right-4 duration-300",
                  p.id === player.id ? "bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-100 scale-[1.02]" : "bg-white border-slate-100 hover:border-indigo-100"
                )} style={{ animationDelay: `${i * 50}ms` }}>
                   <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black shadow-sm",
                        p.id === player.id ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500"
                      )}>{i+1}</span>
                      <span className={cn("text-[13px] font-bold", p.id === player.id ? "text-white" : "text-slate-700")}>{p.nickname}</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className={cn("text-xs font-black", p.id === player.id ? "text-indigo-100" : "text-indigo-600")}>{(p.score||0).toLocaleString()} <span className="text-[9px]">pts</span></span>
                   </div>
                </div>
              ))
            ) : (
              Object.entries(players.reduce((acc, p) => {
                if (p.team) {
                  if (!acc[p.team]) acc[p.team] = { score: 0, members: [] };
                  acc[p.team].score += (p.score || 0);
                  acc[p.team].members.push(p);
                }
                return acc;
              }, {} as Record<string, { score: number, members: any[] }>))
              .sort((a: any, b: any) => b[1].score - a[1].score)
              .map(([team, data]: [string, any], i) => {
                const teamNames = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' } as Record<string, string>;
                const teamColors = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-green-500', YELLOW: 'bg-yellow-500' } as Record<string, string>;
                const teamBorderColors = { RED: 'border-red-100', BLUE: 'border-blue-100', GREEN: 'border-green-100', YELLOW: 'border-yellow-100' } as Record<string, string>;
                
                return (
                  <div key={team} className="flex flex-col gap-2 p-3.5 rounded-2xl border bg-white border-slate-100 hover:border-indigo-100 transition-all animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full text-[10px] font-black text-slate-500">{i+1}</span>
                           <div className={cn("w-3 h-3 rounded-full shadow-sm", teamColors[team])} />
                           <span className="text-[13px] font-black text-slate-700">{teamNames[team] || team}</span>
                        </div>
                        <span className="text-xs font-black text-indigo-600">{data.score.toLocaleString()} <span className="text-[9px]">pts</span></span>
                     </div>
                     
                     {/* Team Members List */}
                     <div className={cn("mt-2 pt-2 border-t flex flex-wrap gap-1.5", teamBorderColors[team])}>
                        {data.members.sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((m: any) => (
                           <div key={m.id} className={cn(
                             "px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1",
                             m.id === player.id ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400" : "bg-slate-50 text-slate-500 border border-slate-100"
                           )}>
                              <span>{m.nickname}</span>
                              <span className={cn("opacity-70 font-black", m.id === player.id ? "text-indigo-100" : "text-indigo-400")}>{m.score || 0}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. Guide Sidebar (Top-Left) */}
      <div 
        ref={helpSidebarRef}
        className={cn(
          "fixed left-0 top-4 z-[250] transition-transform duration-300 flex items-start",
          showHelpTab ? "translate-x-0" : "translate-x-[calc(-100%+40px)]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-64 md:w-72 h-[calc(90vh-40px)] bg-white shadow-[10px_0_40px_rgba(0,0,0,0.1)] border-2 border-indigo-100 rounded-r-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between border-b-2 border-indigo-50 pb-3 mb-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <span className="p-1 bg-indigo-50 rounded-lg"><HelpCircle size={14} className="text-indigo-600" /></span>
              게임 가이드
            </h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">Help</span>
          </div>
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {helpSections.map((section: any, idx: number) => (
              <div key={idx} className="space-y-3">
                <div className="text-[11px] font-black text-indigo-600 uppercase tracking-tighter">{section.title}</div>
                <div className="space-y-2">
                  {section.items.map((item: any, iIdx: number) => (
                    <div key={iIdx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[11px] font-bold text-slate-900">{item.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight font-medium">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button 
          onClick={() => { setShowHelpTab(!showHelpTab); setShowScoreTab(false); }} 
          className={cn(
            "w-10 h-24 flex flex-col items-center justify-center gap-2 rounded-r-2xl shadow-[10px_0_20px_rgba(0,0,0,0.05)] transition-all",
            showHelpTab ? "bg-indigo-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
          )}
        >
          <HelpCircle size={18} className={cn(showHelpTab && "animate-pulse")} />
          <span className="text-[8px] font-black [writing-mode:vertical-lr] tracking-tighter">GUIDE</span>
          {showHelpTab ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </>
  );
}
