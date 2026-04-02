import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/DialogProvider';
import { cn } from '@/lib/utils';
import { 
  Trophy, Clock, Check, X, RefreshCw, Zap, Gift, 
  Shield, TrendingUp, ChevronLeft, ChevronRight, Scissors, Keyboard, Layers,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MathInput } from '@/components/ui/MathInput';
import { SegmentedInput } from '@/components/game/SegmentedInput';
import { IntroOverlay } from '@/components/game/IntroOverlay';

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

const hasMathSymbols = (text?: string) => {
  if (!text) return false;
  return /[\+\-\*\/\=\^\_\{\}\[\]\(\)\\]/.test(text) || text.includes('\\') || text.includes('$');
};

export function GameDisplay({ game, player, players, onSubmit, refresh, result, onRetract }: GameDisplayProps) {
  const { showConfirm } = useDialog();
  const [answer, setAnswer] = useState("");
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [internalSubmitted, setInternalSubmitted] = useState(false);
  const [showScoreTab, setShowScoreTab] = useState(false);
  const [rankingTab, setRankingTab] = useState<'individual' | 'team'>('individual');
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  
  const totalQuestions = game.options?.questions?.length || 0;
  const currentQuestion = game.options?.questions[game.current_q_index];
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [shieldBlock, setShieldBlock] = useState<{nickname: string, type: string} | null>(null);

  const confettiTriggered = useRef<string | null>(null); 
  const firstBlankRef = useRef<HTMLInputElement>(null);

  // --- Sequential Interactive Swap Selection ---
  const [isMyTurnToSwap, setIsMyTurnToSwap] = useState(false);
  const [swapCommitted, setSwapCommitted] = useState(false);
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);
  const [showFirstQInstruction, setShowFirstQInstruction] = useState(false);
  const [activeSwapperName, setActiveSwapperName] = useState<string | null>(null);
  const [swapResultText, setSwapResultText] = useState<string | null>(null);
  const [pendingSwapTarget, setPendingSwapTarget] = useState<any>(null);

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
      if (result?.id) {
         const newEvent = (result.event || "")
           .split(',')
           .map((e: string) => e.trim() === 'swap' ? 'swap_done' : e)
           .join(',');
         await supabase.from('answers').update({ event: newEvent }).eq('id', result.id);
      }

      const channel = supabase.channel(`game_events_${game.id}`);
      await channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'EXECUTE_SWAP',
            payload: { swapperId: player.id, targetId }
          });
          supabase.removeChannel(channel);
        }
      });

      if (targetId) {
        setSwapResultText(`${targetName} 학생과 점수를 바꿨습니다!`);
      } else {
        setSwapResultText(`점수 바꾸기를 하지 않고 넘어갔습니다.`);
      }
    } catch (err) {
      console.error("Swap execution failed:", err);
      setIsSwapExecuting(false);
    }
    setTimeout(() => { setIsSwapExecuting(false); }, 5000);
  };

  // Realtime Listeners & State Sync
  useEffect(() => {
    if (!game?.id || !player.id) return;

    // 1. Initial State Sync from persistent DB state (to prevent race conditions)
    if (game.status === 'RESULT') {
      const swapState = game.options?.swapState;
      console.log("[Student] Syncing swapState from DB:", swapState);
      if (swapState && swapState.currentSwapperId) {
        setActiveSwapperName(swapState.currentSwapperNickname);
        if (String(swapState.currentSwapperId) === String(player.id)) {
          setIsMyTurnToSwap(true);
          setSwapResultText(null);
        } else {
          setIsMyTurnToSwap(false);
        }
      } else {
        setActiveSwapperName(null);
        setIsMyTurnToSwap(false);
      }
    }
    
    const channel = supabase.channel(`game_events_${game.id}`)
      .on('broadcast', { event: 'START_SWAP' }, ({ payload }: { payload: any }) => {
        setActiveSwapperName(payload.nickname);
        const myId = String(player.id || "").trim();
        const swapperId = String(payload.playerId || "").trim();
        if (swapperId === myId) {
          setIsMyTurnToSwap(true);
          setSwapResultText(null);
          // Automatically open the score tab for the swapper so they can choose a target
          setShowScoreTab(true);
        } else {
          setIsMyTurnToSwap(false);
        }
      })
      .on('broadcast', { event: 'SWAP_COMPLETED' }, ({ payload }: { payload: any }) => {
        const { swapperId, swapperName, targetName, targetId, skipped } = payload;
        setActiveSwapperName(null);
        setIsSwapExecuting(false);
        setIsMyTurnToSwap(false);

        if (swapperId === player.id) {
          if (skipped) setSwapResultText("점수 바꾸기를 하지 않고 넘어갔습니다.");
          else {
            setSwapResultText(`${targetName} 학생과 점수를 바꿨습니다!`);
            confetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
          }
          setSwapCommitted(true);
        } else if (targetId === player.id && !skipped) {
          setSwapResultText(`${swapperName} 학생이 당신과 점수를 바꿨습니다!`);
        }
      })
      .on('broadcast', { event: 'SHIELD_BLOCK' }, ({ payload }: { payload: any }) => {
        if (String(payload.targetId) === String(player.id)) {
          setShieldBlock({ nickname: payload.attackerName || payload.nickname, type: payload.type });
          setTimeout(() => setShieldBlock(null), 3000);
        }
      })
      .on('broadcast', { event: 'EMOJI_REACTION' }, ({ payload }: { payload: any }) => {
        const newEmoji = { id: Date.now() + Math.random(), emoji: payload.emoji, left: Math.random() * 80 + 10 };
        setFloatingEmojis((prev: any[]) => [...prev, newEmoji]);
        setTimeout(() => setFloatingEmojis((prev: any[]) => prev.filter((e: any) => e.id !== newEmoji.id)), 3000);
      })
      .on('broadcast', { event: 'GAME_UPDATE' }, () => {
        refresh();
      })
      .on('broadcast', { event: 'ROUND_RESULTS_READY' }, ({ payload }: { payload: any }) => {
        console.log("[Student] Round results ready broadcast received:", payload);
        refresh();
      })
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showScoreTab && sidebarRef.current && !sidebarRef.current.contains(target)) {
        setShowScoreTab(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => { 
      supabase.removeChannel(channel); 
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [game?.id, player.id, refresh, showScoreTab, setShowScoreTab]);

  // Sync state with results
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


  // Sync Timer from Host
  const [timeLeft, setTimeLeft] = useState<number>(currentQuestion?.timeLimit || 20);

  useEffect(() => {
    if (game?.status === 'PLAYING' && game.current_q_index === 0 && !submitted) {
       setShowIntro(true);
    }
  }, [game.status, game.current_q_index, submitted]);

  useEffect(() => {
    if (game?.status === 'PLAYING' && game?.options?.current_q_started_at) {
      // Logic for first question instruction
      if (game.current_q_index === 0) {
        const startTime = new Date(game.options.current_q_started_at).getTime();
        const now = Date.now();
        if (now - startTime < 5000) {
          setShowFirstQInstruction(true);
          const timer = setTimeout(() => setShowFirstQInstruction(false), 5000 - (now - startTime));
          return () => clearTimeout(timer);
        }
      } else {
        setShowFirstQInstruction(false);
      }

      const startTime = new Date(game.options.current_q_started_at).getTime();
      const limit = (currentQuestion?.timeLimit || 20) * 1000;
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(0, Math.ceil((limit - elapsed) / 1000));
        setTimeLeft(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 500);
      return () => clearInterval(interval);
    } else {
      setShowFirstQInstruction(false);
    }
  }, [game?.status, game?.options?.current_q_started_at, game?.current_q_index, currentQuestion?.timeLimit]);

  // Font Scaling Helpers
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

  const handleAnswerChange = (val: string) => setAnswer(val);

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

  if (game.status === "RESULT" && result) {
    const getEventInfo = (eventCode: string) => {
      if (!eventCode || eventCode === 'none') return null;
      const e = eventCode.trim().toLowerCase();
      if (e === 'double') return { icon: '✨', text: '두배 찬스!', color: 'bg-yellow-400', desc: '다음 문제 점수가 2배가 됩니다!' };
      if (e === 'strike_bonus') return { icon: '🔥', text: '콤보 보너스!', color: 'bg-orange-500', desc: '연속 정답으로 추가 점수를 얻었습니다!' };
      if (e === 'strike_double') return { icon: '💥', text: '슈퍼 콤보!', color: 'bg-red-500', desc: '연속 정답에 두배 찬스까지! 점수가 폭발합니다!' };
      if (e === 'shield') return { icon: '🛡️', text: '방어막 획득!', color: 'bg-blue-400', desc: '공격을 한 번 막아줄 방어막이 생겼습니다!' };
      if (e === 'swap') return { icon: '🔄', text: '점수 바꾸기!', color: 'bg-indigo-500', desc: '다른 친구와 점수를 바꿀 수 있습니다!' };
      if (e === 'strike') return { icon: '⚡', text: '콤보 획득!', color: 'bg-amber-400', desc: '다음 문제 정답 시 보너스 점수를 얻습니다!' };
      if (e === 'cut') return { icon: '✂️', text: '점수 삭감!', color: 'bg-red-500', desc: '상대방의 점수를 깎았습니다!' };
      if (e === 'donate') return { icon: '📤', text: '점수 기부!', color: 'bg-emerald-500', desc: '팀원들에게 점수를 나누어 주었습니다!' };
      if (e.startsWith('gift')) {
        const donor = e.split(':')[1] || '누군가';
        return { icon: '🎁', text: '점수 선물!', color: 'bg-pink-400', desc: `${donor} 학생이 점수를 선물했습니다!` };
      }
      if (e.endsWith('_blocked')) return { icon: '🛡️', text: '공격 방어!', color: 'bg-slate-500', desc: '방어막으로 상대방의 공격을 막아냈습니다!' };
      return null;
    };

    const events = (result.event || "").split(',').filter((e: string) => e && e !== 'none');
    const eventInfos = events.map(getEventInfo).filter(Boolean);

    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 relative">
        {(swapResultText || pendingSwapTarget || (activeSwapperName && !isMyTurnToSwap) || isMyTurnToSwap) && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300 border-8 border-indigo-500 flex flex-col items-center text-center">
                 {pendingSwapTarget ? (
                    <>
                       <div className="text-5xl mb-4">🔄</div>
                       <h3 className="text-2xl font-black text-indigo-900 mb-2">{pendingSwapTarget.nickname} 학생과<br/>점수를 바꿀까요?</h3>
                       <p className="text-slate-500 font-bold mb-6">내가 가진 점수와 바꿀 수 있습니다.</p>
                       <div className="flex gap-3 w-full">
                          <Button size="lg" className="flex-1 rounded-2xl bg-indigo-600" onClick={() => handleSwapSelection(pendingSwapTarget.id, pendingSwapTarget.nickname)}>바꾸기</Button>
                          <Button size="lg" variant="ghost" className="flex-1 rounded-2xl border-2" onClick={() => setPendingSwapTarget(null)}>취소</Button>
                       </div>
                    </>
                 ) : isMyTurnToSwap ? (
                    <div className="w-full flex flex-col items-center max-h-[85vh]">
                        <div className="text-4xl mb-4">🔄</div>
                        <h3 className="text-2xl font-black text-indigo-900 mb-1">점수 바꾸기!</h3>
                        <p className="text-slate-500 font-bold mb-4">누구와 점수를 바꿀까요?</p>
                        
                        {/* Current Player Score Card (Fixed) */}
                        <div className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                                    <User size={18} />
                                </div>
                                <span className="font-bold text-indigo-900">나의 현재 점수</span>
                            </div>
                            <span className="text-2xl font-black text-indigo-600">{(player.score || 0).toLocaleString()}점</span>
                        </div>

                        <div className="w-full overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4" style={{ maxHeight: 'calc(80vh - 350px)', minHeight: '120px' }}>
                           {players.filter(p => p.id !== player.id).sort((a,b) => (b.score||0)-(a.score||0)).map(p => (
                              <button
                                 key={p.id}
                                 onClick={() => handleSwapSelection(p.id, p.nickname)}
                                 className="w-full flex items-center justify-between p-3 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all group animate-in slide-in-from-right-4 duration-300"
                              >
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                                       <img src={`/avatars/avatar_${p.avatar_id || 1}.png`} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                    <span className="font-bold text-slate-700">{p.nickname}</span>
                                 </div>
                                 <span className="font-black text-indigo-600">{(p.score || 0).toLocaleString()}점</span>
                              </button>
                           ))}
                        </div>
                        <Button variant="ghost" className="w-full rounded-2xl border-2 border-slate-100 py-4" onClick={() => handleSwapSelection(null, null)}>넘어가기 (선택 안함)</Button>
                     </div>
                 ) : activeSwapperName && !isMyTurnToSwap ? (
                    <>
                       <div className="text-5xl mb-4 animate-bounce">🔄</div>
                       <h3 className="text-2xl font-black text-indigo-900 mb-4">{activeSwapperName} 학생이<br/>점수를 바꾸고 있습니다!</h3>
                       <div className="flex items-center gap-2 text-indigo-500 font-bold">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" />
                       </div>
                       <p className="text-slate-400 text-sm mt-6 font-bold">잠시만 기다려주세요...</p>
                    </>
                 ) : (
                    <>
                       <div className="text-5xl mb-4">✨</div>
                       <h3 className="text-2xl font-black text-indigo-900 mb-4">{swapResultText}</h3>
                       <Button size="lg" className="w-full rounded-2xl bg-indigo-600" onClick={() => { setSwapResultText(null); if (swapCommitted) refresh(); }}>확인</Button>
                    </>
                 )}
              </div>
           </div>
        )}

        <div className={cn(
          "w-full bg-white rounded-[4rem] border-[16px] shadow-2xl overflow-hidden flex flex-col items-center p-8 transition-all duration-500 scale-105",
          result.is_correct ? "border-emerald-500" : "border-red-500"
        )}>
          <div className="text-xl md:text-2xl font-black text-slate-800 font-jua mb-4">
            {result.is_correct ? "정답입니다!" : "아쉬워요!"}
          </div>
          <div className="mb-6 flex flex-col items-center gap-4">
            {result.is_correct ? (
              <div className="relative">
                <Check className="text-emerald-500" size={80} strokeWidth={8} />
                <div className="absolute inset-0 animate-ping bg-emerald-100 rounded-full opacity-20" />
              </div>
            ) : (
              <X className="text-red-500" size={100} strokeWidth={6} />
            )}
            
            {eventInfos.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {eventInfos.map((info: any, idx: number) => (
                  <div key={idx} className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-2xl text-white font-black animate-bounce shadow-lg",
                    info!.color
                  )}>
                    <span className="text-xl">{info!.icon}</span>
                    <span className="text-sm">{info!.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-[3rem] p-8 w-full flex flex-col items-center">
            <div className={cn("text-6xl md:text-8xl font-black mb-2", result.is_correct ? "text-indigo-600" : "text-red-500")}>
              {result.points_added ?? result.points_awarded ?? 0}점
            </div>
            
            {eventInfos.length > 0 && (
               <div className="flex flex-col gap-1.5 mt-2 mb-6">
                 {eventInfos.map((info: any, idx: number) => (
                   <div key={idx} className="bg-white/80 backdrop-blur px-4 py-2 rounded-xl border border-indigo-100 text-indigo-600 font-bold text-sm shadow-sm text-center">
                     ✨ {info!.desc}
                   </div>
                 ))}
               </div>
            )}

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-indigo-50 p-3 rounded-2xl border text-center">
                <div className="text-[10px] text-slate-400 font-black uppercase">내가 쓴 답</div>
                <div className="font-bold truncate">{answer || "(없음)"}</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-center">
                <div className="text-[10px] text-indigo-400 font-black uppercase">정답</div>
                <div className="font-bold text-indigo-600 truncate">{currentQuestion?.a}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return <div className="p-12 text-center text-indigo-400 animate-pulse font-black">문제를 불러오는 중...</div>;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 md:p-6 overflow-hidden">
      <div 
        ref={sidebarRef}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 flex items-center",
          showScoreTab ? "translate-x-0" : "translate-x-[calc(100%-40px)]"
        )}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <button onClick={() => setShowScoreTab(!showScoreTab)} className="w-10 h-24 bg-indigo-600 text-white rounded-l-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-colors">
          <Trophy size={18} />
          <span className="text-[8px] font-black [writing-mode:vertical-lr]">RANKING</span>
          {showScoreTab ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className="w-64 md:w-72 h-[60vh] bg-white shadow-2xl border-2 border-indigo-100 rounded-l-2xl p-4 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="flex items-center justify-between border-b pb-2 mb-3 shrink-0">
            <h3 className="font-black text-indigo-900">순위 현황</h3>
            <span className="text-[10px] text-indigo-400 font-bold">실시간</span>
          </div>

          {game?.options?.isTeamMode && player?.team && (
            <div className="mb-4 p-3 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100/50 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-indigo-400">우리팀 현황</span>
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-full">
                  {player.team === 'RED' ? '빨강팀' : player.team === 'BLUE' ? '파랑팀' : player.team === 'GREEN' ? '초록팀' : player.team === 'YELLOW' ? '노랑팀' : player.team}
                </span>
              </div>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {players.filter(p => p.team === player.team).map(member => (
                  <div key={member.id} className="flex justify-between items-center bg-white/60 p-1.5 rounded-lg border border-indigo-50">
                    <span className={cn("text-[11px] font-bold truncate pr-1 flex-1", member.id === player.id ? "text-indigo-600" : "text-slate-600")}>
                      {member.id === player.id && "👤 "}{member.nickname}
                    </span>
                    <span className="text-[11px] font-black text-slate-500 tabular-nums">{(member.score || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center border-t border-indigo-100 pt-2 pb-0.5">
                <span className="text-[10px] font-black text-indigo-800 uppercase tracking-tighter">팀 합산 점수</span>
                <span className="text-sm font-black text-indigo-600 tabular-nums">
                  {players.filter(p => p.team === player.team).reduce((acc, curr) => acc + (curr.score || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {game?.options?.isTeamMode && (
            <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl shrink-0">
              <button onClick={() => setRankingTab('individual')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'individual' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>개인별</button>
              <button onClick={() => setRankingTab('team')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg transition-all", rankingTab === 'team' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>팀별</button>
            </div>
          )}

          <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {(() => {
              if (rankingTab === 'team' && game?.options?.isTeamMode) {
                const teamScores: Record<string, number> = {};
                players.forEach(p => {
                  const t = p.team || "팀 없음";
                  teamScores[t] = (teamScores[t] || 0) + (p.score || 0);
                });
                const sortedTeams = Object.entries(teamScores)
                  .map(([team, score]) => ({ team, score }))
                  .sort((a, b) => b.score - a.score);
                
                const teamRanks = sortedTeams.map((t, i) => {
                  let rank = i + 1;
                  if (i > 0 && t.score === sortedTeams[i-1].score) {
                    const firstIdx = sortedTeams.findIndex(t2 => t2.score === t.score);
                    rank = firstIdx + 1;
                  }
                  return { ...t, rank };
                });

                return (
                  <div className="space-y-4">
                    {teamRanks.map((rank, i) => {
                      const myTeam = player?.team;
                      const isMyTeam = rank.team === myTeam;
                      const members = players.filter(p => p.team === rank.team)
                        .sort((a, b) => b.score - a.score);
                      
                      return (
                        <div key={rank.team} className={cn(
                          "p-4 rounded-2xl border-2 transition-all",
                          isMyTeam 
                            ? "bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-400/20" 
                            : "bg-white border-slate-100"
                        )}>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-black",
                                i === 0 ? "bg-yellow-400 text-white" :
                                i === 1 ? "bg-slate-300 text-white" :
                                i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
                              )}>{rank.rank}</span>
                              <span className={cn(
                                "font-black text-lg",
                                rank.team === 'RED' ? 'text-red-600' :
                                rank.team === 'BLUE' ? 'text-blue-600' :
                                rank.team === 'GREEN' ? 'text-green-600' : 'text-yellow-600'
                              )}>
                                {rank.team === 'RED' ? '빨강팀' : 
                                 rank.team === 'BLUE' ? '파랑팀' : 
                                 rank.team === 'GREEN' ? '초록팀' : '노랑팀'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-400 font-bold block leading-none mb-1">합계 점수</span>
                              <span className="font-black text-xl text-slate-700">{rank.score.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            {members.map(member => (
                              <div key={member.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    rank.team === 'RED' ? 'bg-red-400' :
                                    rank.team === 'BLUE' ? 'bg-blue-400' :
                                    rank.team === 'GREEN' ? 'bg-green-400' : 'bg-yellow-400'
                                  )} />
                                  <span className={cn(
                                    "font-bold",
                                    member.id === player?.id ? "text-indigo-600 underline underline-offset-2" : "text-slate-600"
                                  )}>
                                    {member.nickname} {member.id === player?.id && "(나)"}
                                  </span>
                                </div>
                                <span className="font-black text-slate-500 tabular-nums">
                                  {member.score.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const sorted = [...players].sort((a,b) => (b.score||0)-(a.score||0));
              return (
                <div className="space-y-2">
                  {sorted.map((p, i) => {
                    let rank = i + 1;
                    if (i > 0 && (p.score||0) === (sorted[i-1].score||0)) {
                      const firstIdx = sorted.findIndex(p2 => (p2.score||0) === (p.score||0));
                      rank = firstIdx + 1;
                    }

                    const canSwap = isMyTurnToSwap && p.id !== player.id;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => canSwap && handleSwapSelection(p.id, p.nickname)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl border transition-all relative overflow-hidden",
                          p.id === player.id ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "bg-slate-50 border-slate-100 font-medium",
                          canSwap && "cursor-pointer hover:border-indigo-400 hover:bg-white hover:scale-[1.02] shadow-sm hover:shadow-md ring-4 ring-transparent hover:ring-indigo-500/20 active:scale-95"
                        )}
                      >
                        {canSwap && (
                          <div className="absolute inset-0 bg-indigo-500/5 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black shadow-lg">선택하기</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", rank===1 ? "bg-yellow-400 text-white" : rank===2 ? "bg-slate-300 text-white" : rank===3 ? "bg-orange-300 text-white" : "bg-slate-200 text-slate-500")}>{rank}</span>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0">
                             <img src={`/avatars/avatar_${p.avatar_id || 1}.png`} alt="avatar" className="w-full h-full object-cover" />
                          </div>
                          <span className="font-bold text-sm text-slate-700 truncate max-w-[80px]">{p.nickname} {p.id===player.id && "(나)"}</span>
                        </div>
                        <span className="font-black text-indigo-600 text-sm">{(p.score||0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          {/* Enhanced Swapping Animation */}
          {isSwapExecuting && (
            <div className="fixed inset-0 z-[100] bg-indigo-900/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in transition-all">
              <div className="relative">
                <RefreshCw size={80} className="text-white animate-spin opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-full animate-ping opacity-75" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw size={40} className="text-indigo-500 animate-spin" />
                  </div>
                </div>
              </div>
              <h2 className="text-3xl font-black text-white mt-8 animate-pulse italic tracking-tighter">SWAPPING SCORES...</h2>
              <p className="text-indigo-200 font-bold mt-2">잠시만 기다려 주세요 정산 중입니다!</p>
            </div>
          )}

           {/* First Question Instruction Overlay */}
           {showFirstQInstruction && (
             <div className="fixed inset-0 z-[100] bg-indigo-600 flex flex-col items-center justify-center animate-in zoom-in-95 transition-all p-8 text-center">
                <div className="bg-white/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 animate-bounce">
                   <Layers size={48} className="text-white" />
                </div>
                <h1 className="text-4xl font-black text-white mb-4 tracking-tight leading-tight">
                  수학 키보드 사용 안내
                </h1>
                <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
                   <div className="flex items-center gap-4 text-left">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                         <Keyboard size={20} className="text-indigo-600" />
                      </div>
                      <p className="text-slate-700 font-bold leading-snug">수학 문제를 풀 때 우측 상단 수식 키보드를 활용해 보세요!</p>
                   </div>
                   <div className="flex items-center gap-4 text-left opacity-90 transition-all hover:opacity-100">
                      <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center shrink-0 border border-amber-100">
                         <RefreshCw size={20} className="text-amber-600 animate-spin-slow" />
                      </div>
                      <p className="text-slate-700 font-bold leading-snug">키보드가 입력되지 않으면 [새로고침] 버튼을 눌러주세요!</p>
                   </div>
                   <div className="bg-indigo-50 py-3 rounded-2xl">
                      <span className="text-indigo-600 font-black text-xl animate-pulse">곧 게임이 시작됩니다! (5초)</span>
                   </div>
                </div>
             </div>
           )}

          {isMyTurnToSwap && (
            <div className="mt-4 p-3 bg-indigo-600 rounded-2xl text-white text-center animate-pulse shadow-lg border-b-4 border-indigo-800">
               <div className="text-xs font-black mb-1">🔄 점수 바꾸기 진행 중!</div>
               <div className="text-[10px] font-bold opacity-90">목록에서 바꿀 친구를 누르세요.</div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl p-3 md:p-6 flex flex-col relative overflow-hidden h-full max-h-[94vh] focus-within:ring-0">

        <div className="flex items-center justify-between mb-1 px-2 pt-0.5">
          <div className="bg-indigo-50 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-indigo-100">
            <Trophy size={16} className="text-indigo-500" />
            <span className="text-lg md:text-xl font-black text-indigo-600">Q{(game?.current_q_index ?? 0) + 1}</span>
            <span className="text-xs font-bold text-indigo-300">/ {totalQuestions}</span>
          </div>

          {/* Global Swap Notification for non-swappers */}
          {activeSwapperName && !isMyTurnToSwap && !isSwapExecuting && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 z-[60] animate-bounce">
              <div className="bg-amber-500 text-white px-4 py-1.5 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-xs font-black whitespace-nowrap">{activeSwapperName} 학생이 점수 교체 중...</span>
              </div>
            </div>
          )}

          <div className={cn("px-3 py-1.5 rounded-xl flex items-center gap-2 border-2 transition-all", timeLeft <= 5 ? "bg-red-50 border-red-200 animate-pulse" : "bg-slate-50 border-slate-100")}>
            <Clock size={16} className={timeLeft <= 5 ? "text-red-500" : "text-slate-400"} />
            <span className={cn("text-lg md:text-2xl font-black tabular-nums", timeLeft <= 5 ? "text-red-600" : "text-slate-600")}>{timeLeft}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-2">
          <div className={cn("font-black text-slate-800 break-keep leading-tight text-center py-1 md:py-2", getQuestionFontSize(currentQuestion.q))}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {processMathText(currentQuestion.type === "BLANK" ? 
                currentQuestion.q.split(/\s+/).map((w: string, i: number) => (currentQuestion.blanks || []).includes(i) ? "___" : w).join(" ") 
                : currentQuestion.q)}
            </ReactMarkdown>
          </div>
          {currentQuestion.image_url && <img src={currentQuestion.image_url} alt="q" className="rounded-2xl max-w-full max-h-[35vh] object-contain mx-auto shadow-lg border-2 border-slate-100 mb-2" />}
          
          <div className="space-y-2 flex flex-col flex-1">
            {currentQuestion.type === "BLANK" && !submitted && !internalSubmitted && (
               <div className="text-center font-black text-indigo-500 bg-indigo-50 py-2 rounded-2xl animate-pulse text-sm">
                 💡 빈칸에 알맞은 단어를 입력해 주세요!
               </div>
            )}
            
            {(submitted || internalSubmitted) ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-indigo-50/50 rounded-[2.5rem] border-2 border-indigo-100 border-dashed animate-in zoom-in relative">
                <div className="absolute top-6 right-6 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border-2 border-indigo-100 shadow-sm">
                  <Clock size={14} className={timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-indigo-400"} />
                  <span className={cn("text-lg font-black tabular-nums", timeLeft <= 5 ? "text-red-600" : "text-indigo-600")}>{timeLeft}</span>
                </div>

                <div className="text-4xl md:text-6xl mb-4 animate-bounce">✨</div>
                <h3 className="text-2xl md:text-3xl font-black text-indigo-900 mb-2 italic">정답 제출 완료!</h3>
                <p className="text-slate-500 font-bold text-center">우와! 정답을 잘 제출했어요. <br/>다른 친구들이 문제를 다 풀 때까지 우리 조금만 기다려 볼까요? 😊</p>
                {!isTimeOut && (
                  <button onClick={handleRetractClick} className="mt-8 px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-200 rounded-2xl font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group">
                    <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" /> 다시 고치기
                  </button>
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
                          if (bIdx !== -1) return <SegmentedInput key={wordIdx} value={blankAnswers[wordIdx] || ""} length={word.length} onChange={(val) => handleBlankChange(wordIdx, val, blanks)} onEnter={() => handleSubmit()} autoFocus={bIdx === 0} firstRef={bIdx === 0 ? firstBlankRef : undefined} />;
                          return <span key={wordIdx} className="text-xl md:text-2xl font-black text-slate-400">{word}</span>;
                        })}
                      </div>
                    ) : (
                      <div className="w-full">
                         <MathInput 
                            value={answer} 
                            onChange={handleAnswerChange} 
                            onEnter={() => handleSubmit()} 
                            className="w-full text-lg md:text-xl font-bold p-1" 
                            template={currentQuestion.template} 
                            focusOnMount={true} 
                            isFirstQuestion={game.current_q_index === 0} 
                            gameId={game.id} 
                         />
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
     
     {showIntro && <IntroOverlay onClose={() => setShowIntro(false)} />}
   </div>
 );
}
