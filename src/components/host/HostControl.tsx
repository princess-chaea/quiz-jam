"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { 
  Trophy, Medal, Zap, Users, Clock, ArrowRight, Home, 
  Settings, Save, Plus, Trash2, Edit2, Play, 
  CheckCircle2, AlertCircle, Menu, X, ChevronRight,
  Shield, Gift, RefreshCw, Scissors, Check,
  Award, HelpCircle, LogOut, Eye, EyeOff, Layers
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import { cn, getChoseong, processMathText } from "@/lib/utils";
import { useDialog } from "@/components/ui/DialogProvider";
import { PlayerBar } from "@/components/game/PlayerBar";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface HostControlProps {
  game: any;
  players: any[];
  refreshPlayers?: () => Promise<void>;
}

export function HostControl({ game, players, refreshPlayers }: HostControlProps) {
  const [answers, setAnswers] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [swapQueue, setSwapQueue] = useState<any[]>([]);
  const [currentSwapperId, setCurrentSwapperId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30); // Default
  const [showLargeAnswer, setShowLargeAnswer] = useState(false);
  const { showConfirm, showAlert } = useDialog();
  const currentQuestion = game.options?.questions[game.current_q_index];
  
  // 1. Refs (Always at the top)
  const playersRef = useRef(players);
  const answersRef = useRef(answers);
  const gameRef = useRef(game);
  const swapQueueRef = useRef(swapQueue);
  const currentSwapperIdRef = useRef(currentSwapperId);
  const finishRoundRef = useRef<any>(null);

  // 2. Logic Functions
  const handleFinishRound = async () => {
    if (calculating) return;
    
    // If prematurely ending, ask for confirmation
    if (timeLeft > 0 && answersRef.current.length < playersRef.current.length) {
      const confirmed = await showConfirm(`아직 제출하지 않은 학생이 ${playersRef.current.length - answersRef.current.length}명 있습니다.\n정말로 마감하시겠습니까?`);
      if (!confirmed) return;
    }

    setCalculating(true);
    
    try {
      setCalculating(true);
      
      // Safety delay to allow late student submissions to propagate to DB
      await new Promise(resolve => setTimeout(resolve, 500));

      const currentGame = gameRef.current;
      const qIndex = currentGame.current_q_index;
      const question = currentGame.options?.questions[qIndex];

      // 1. Fetch FRESH answers directly from DB to avoid staleness
      const { data: freshAnswers, error: freshErr } = await supabase
        .from("answers")
        .select("*")
        .eq("game_id", game.id)
        .eq("q_index", qIndex);

      if (freshErr) throw freshErr;
      const currentAnswers = freshAnswers || [];
      const currentPlayers = playersRef.current;

      // 2. Calculate base results
      const calculatedResults = currentPlayers.map(player => {
        const answer = currentAnswers.find(a => a.player_id === player.id);
        const isCorrect = answer?.is_correct || false;
        let basePoints = question.points || 10;
        let points = 0;
        let event = 'none';

        const probs = game.options?.probabilities || { double: 5, swap: 5, strike: 5, shield: 5, cut: 5, donate: 5 };
        const p = (key: string) => {
          const val = probs[key];
          return (val !== undefined ? val : 5) / 100;
        };

        if (isCorrect) {
          points = basePoints;
          const acquiredEvents: string[] = [];

          if (player.buffs?.includes('STRIKE')) {
            points *= 2;
            acquiredEvents.push('strike_bonus');
          }
          
          const probs = game.options?.probabilities || { double: 5, swap: 5, strike: 5, shield: 5, cut: 5, donate: 5 };
          const p = (key: string) => (probs[key] !== undefined ? probs[key] : 5) / 100;

          // Independent chances for each item
          if (Math.random() < p('double')) {
            points *= 2;
            acquiredEvents.push('double');
          }
          if (Math.random() < p('swap')) acquiredEvents.push('swap');
          if (Math.random() < p('strike')) acquiredEvents.push('strike');
          if (Math.random() < p('shield')) acquiredEvents.push('shield');

          if (acquiredEvents.length === 0) event = 'none';
          else {
            // Check for combine super bonus if strike + double
            if (acquiredEvents.includes('strike_bonus') && acquiredEvents.includes('double')) {
              // already pushes both, keep them or combine? User wants multiple anyway.
            }
            event = acquiredEvents.join(',');
          }
        } else {
          // Negative effects (Independent chance too)
          const negativeEvents: string[] = [];
          const probs = game.options?.probabilities || { double: 5, swap: 5, strike: 5, shield: 5, cut: 5, donate: 5 };
          const p = (key: string) => (probs[key] !== undefined ? probs[key] : 5) / 100;

          if (Math.random() < p('cut')) negativeEvents.push('cut');
          if (Math.random() < p('donate')) negativeEvents.push('donate');

          if (negativeEvents.length > 0) {
            // Each negative item can be blocked by a single shield? 
            // For simplicity, if shield exists, it blocks the first one and is consumed.
            let currentBuffs = [...(player.buffs || [])];
            const finalNegEvents = negativeEvents.map(evt => {
              if (currentBuffs.includes('SHIELD')) {
                currentBuffs = currentBuffs.filter(b => b !== 'SHIELD');
                return evt + '_blocked';
              }
              if (evt === 'cut') points -= basePoints;
              if (evt === 'donate') points -= 20;
              return evt;
            });
            event = finalNegEvents.join(',');
          } else {
            event = 'none';
          }
        }

        let newBuffs = [...(player.buffs || [])];
        // Strike is consumed after ANY answer attempt
        if (newBuffs.includes('STRIKE')) {
          newBuffs = newBuffs.filter(b => b !== 'STRIKE');
        }
        
        // Consume shield if any event blocked it
        if (event.includes('_blocked')) {
          newBuffs = newBuffs.filter(b => b !== 'SHIELD');
        }
        
        // Add new buffs (independent of each other)
        if (event.includes('strike')) newBuffs.push('STRIKE');
        if (event.includes('shield')) newBuffs.push('SHIELD');

        return { 
          player, 
          points, 
          event, 
          newBuffs: Array.from(new Set(newBuffs)),
          isCorrect,
          answerId: answer?.id,
          rawAnswer: answer?.answer || '(시간초과)'
        };
      });

      // 3. Identification of Swap Earners (Sequential Ordering)
      const swappers = calculatedResults
        .filter(res => res.event.includes('swap'))
        .map(res => {
          const ans = currentAnswers.find(a => a.player_id === res.player.id);
          return {
            id: res.player.id.toString(),
            nickname: res.player.nickname?.trim() || "",
            submitted_at: ans?.created_at ? new Date(ans.created_at).getTime() : 0,
            answerId: ans?.id
          };
        })
        // LATEST submitter first (Strategic advantage for late answers)
        .sort((a, b) => b.submitted_at - a.submitted_at);

      // Handle Donation BEFORE creating final arrays
      calculatedResults.forEach(res => {
        if (res.event.includes('donate')) {
          const donorNick = res.player.nickname;
          const donorTeam = res.player.team;
          
          // Find candidates: correct answer, NOT the donor, and NOT donor's teammate (if team mode)
          const candidates = calculatedResults.filter(r => {
            if (!r.isCorrect) return false;
            if (r.player.id === res.player.id) return false;
            // Team mode exclusion
            if (game.options?.isTeamMode && donorTeam && r.player.team === donorTeam) return false;
            return true;
          });
          
          // Pick up to 3 random candidates
          const targets = candidates.sort(() => 0.5 - Math.random()).slice(0, 3);
          
          // Donor loses 10 points per target (Max 30)
          res.points = -10 * targets.length;
          
          targets.forEach(t => {
            // Each target gains 10 points
            t.points += 10;
            if (t.event === 'none') {
              t.event = `gift:${donorNick}`;
            }
          });
        }
      });

      const finalResults = [...calculatedResults];
      
      // Update local answers state immediately so UI updates
      const updatedAnswers = finalResults.map(res => ({
        player_id: res.player.id,
        q_index: qIndex,
        is_correct: res.isCorrect,
        points_awarded: res.points,
        event: res.event,
        answer: res.rawAnswer
      }));

      console.log("Calculated Final Results for Host:", finalResults.map(r => ({ nick: r.player.nickname, pts: r.points, corr: r.isCorrect, evt: r.event })));
      setAnswers(updatedAnswers);

      // Status 1: Update Answers, Players, and Broadcast events
      const answerPromises = finalResults.map(async res => {
        const answerData: any = {
          game_id: game.id,
          player_id: res.player.id,
          q_index: qIndex,
          is_correct: res.isCorrect,
          points_awarded: res.points,
          event: res.event,
          answer: res.rawAnswer
        };

        if (res.answerId) {
          const { error } = await supabase.from('answers').update(answerData).eq('id', res.answerId);
          if (error) console.error(`[Sync] Update failed for ${res.player.nickname}:`, error);
        } else {
          // Robust Manual Upsert: check if answer exists by natural key
          const { data: existing } = await supabase.from('answers')
            .select('id')
            .eq('game_id', game.id)
            .eq('player_id', res.player.id)
            .eq('q_index', qIndex)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase.from('answers').update(answerData).eq('id', existing.id);
            if (error) console.error(`[Sync] Late update failed for ${res.player.nickname}:`, error);
          } else {
            const { error } = await supabase.from('answers').insert(answerData);
            if (error) console.error(`[Sync] Insert failed for ${res.player.nickname}:`, error);
          }
        }
      });

      const playerPromises = finalResults.map(async res => {
        const { error } = await supabase.from('players')
          .update({
            score: res.player.score + res.points,
            buffs: res.newBuffs
          })
          .eq('id', res.player.id);
        if (error) console.error("Player update failed for", res.player.nickname, error);
      });

      // Wait for all data to be committed before updating game status
      await Promise.all([...answerPromises, ...playerPromises]);

      // 4. Handle Broadcasts (Shield Block, etc.)
      const blockedResults = finalResults.filter(r => r.event.includes('_blocked'));
      if (blockedResults.length > 0) {
        const eventChannel = supabase.channel(`game_swaps_${game.id}`);
        eventChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            for (const res of blockedResults) {
              const blockedTypes = res.event.split(',').filter(e => e.endsWith('_blocked'));
              for (const bType of blockedTypes) {
                await eventChannel.send({
                  type: 'broadcast',
                  event: 'SHIELD_BLOCK',
                  payload: { 
                    nickname: res.player.nickname,
                    type: bType.replace('_blocked', '')
                  }
                });
              }
            }
            setTimeout(() => supabase.removeChannel(eventChannel), 2000);
          }
        });
      }

      // 5. Initialize local swap state
      if (swappers.length > 0) {
        setSwapQueue(swappers);
        setCurrentSwapperId(swappers[0].id);
        // CRITICAL: Update refs immediately to prevent race conditions with incoming broadcasts
        swapQueueRef.current = swappers;
        currentSwapperIdRef.current = swappers[0].id;
      } else {
        setSwapQueue([]);
        setCurrentSwapperId(null);
        swapQueueRef.current = [];
        currentSwapperIdRef.current = null;
      }

      // 6. Broadcast Results Ready (to trigger student re-fetch)
      const resultChannel = supabase.channel(`game_results_${game.id}`);
      resultChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[Host] Broadcasting ROUND_RESULTS_READY");
          await resultChannel.send({
            type: 'broadcast',
            event: 'ROUND_RESULTS_READY',
            payload: { q_index: qIndex, results: updatedAnswers }
          });
          
             // 7. Update Game Status & Initial Swap State in DB
             const swapState = {
               queue: swappers,
               currentSwapperId: swappers.length > 0 ? swappers[0].id : null,
               currentSwapperNickname: swappers.length > 0 ? swappers[0].nickname : null
             };

             console.log("[Host] Saving initial swapState to DB:", swapState);
             
             const newOptions = {
               ...(game.options || {}),
               swapState
             };

             await supabase.from("games")
               .update({ 
                 status: "RESULT",
                 options: newOptions
               })
               .eq("id", game.id);
             
             // 8. BROADCAST immediate refresh for all players
             await resultChannel.send({
               type: 'broadcast',
               event: 'GAME_UPDATE',
               payload: { status: "RESULT", q_index: qIndex }
             });

             // If there are swappers, trigger the first one explicitly via broadcast
             if (swappers.length > 0) {
               console.log("[Host] Broadcasting FIRST swap start:", swappers[0].nickname);
               await resultChannel.send({
                 type: 'broadcast',
                 event: 'START_SWAP',
                 payload: { playerId: swappers[0].id, nickname: swappers[0].nickname }
               });
             }
             
             setTimeout(() => supabase.removeChannel(resultChannel), 3000);
          }
        });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (err) {
      console.error("정산 실패:", err);
    } finally {
      // Small timeout to allow state updates to settle before enabling buttons
      setTimeout(() => setCalculating(false), 2000);
    }
  };

  const handleForceNext = async () => {
    const confirmed = await showConfirm("아직 점수 교체가 진행 중입니다. 정말로 강제로 다음 단계로 넘어가시겠습니까?\n(일부 학생의 점수가 반영되지 않을 수 있습니다)");
    if (!confirmed) return;
    
    // Use a dedicated flag or just don't clear swapper status yet
    setCalculating(true);
    try {
      // Direct call to turn logic (bypassing the calculating guard if needed)
      await performNextTurnAction();
    } finally {
      // The useEffect will handle resetting swap states once the DB update propagates
    }
  };

  const handleNextQuestion = async () => {
    if (calculating) return;
    setCalculating(true);
    try {
      await performNextTurnAction();
    } finally {
      setCalculating(false);
    }
  };

  // Internal common logic for moving to next round
  const performNextTurnAction = async () => {
    const isLast = game.current_q_index >= (game.options?.questions?.length || 1) - 1;
    const { error } = await supabase
      .from("games")
      .update({ 
        status: isLast ? "ENDED" : "PLAYING",
        current_q_index: isLast ? game.current_q_index : game.current_q_index + 1,
        current_hint_stage: 0
      })
      .eq("id", game.id);
    
    if (error) {
      alert("이동 실패: " + error.message);
      throw error;
    }

    // BROADCAST immediate refresh for all players to move to new question
    const channel = supabase.channel(`game_realtime:${game.id}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'GAME_UPDATE',
          payload: { status: isLast ? "ENDED" : "PLAYING", q_index: isLast ? game.current_q_index : game.current_q_index + 1 }
        });
        setTimeout(() => supabase.removeChannel(channel), 2000);
      }
    });
  };

  const handleExitGame = async () => {
    const confirmed = await showConfirm("정말로 게임을 종료하시겠습니까?");
    if (!confirmed) return;
    try {
      setCalculating(true);
      await supabase.from("games").update({ status: "ENDED" }).eq("id", game.id);
    } catch (err) {
      console.error("Exit failed:", err);
    } finally {
      setCalculating(false);
    }
  };

  const handleHintStage = async (stage: number) => {
    if (game.current_hint_stage >= stage) return;
    let message = stage === 1 ? "1단계 힌트를 공개하시겠습니까?" : "2단계 힌트를 공개하시겠습니까?";
    const confirmed = await showConfirm(message);
    if (!confirmed) return;
    
    const { error } = await supabase.from("games").update({ current_hint_stage: stage }).eq("id", game.id);
    if (!error) {
      // Broadcast hint reveal for immediate student-side reaction
      const channel = supabase.channel(`game_realtime:${game.id}`);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'HINT_REVEAL',
            payload: { stage }
          });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });
    }
  };

  // 3. Effects (Must be above any status return)
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { swapQueueRef.current = swapQueue; }, [swapQueue]);
  useEffect(() => { currentSwapperIdRef.current = currentSwapperId; }, [currentSwapperId]);
  useEffect(() => { finishRoundRef.current = handleFinishRound; });

  // Sequential Swap Listener
  useEffect(() => {
    if (!game.id) return;
    
    const channel = supabase.channel(`game_swaps_${game.id}`)
      .on('broadcast', { event: 'EXECUTE_SWAP' }, async ({ payload }: { payload: any }) => {
        const { swapperId, targetId } = payload;
        
        // 1. Fetch info
        const { data: swapper } = await supabase.from('players').select('score, nickname').eq('id', swapperId).single();
        
        const advanceQueue = async () => {
          const currentQueue = swapQueueRef.current || [];
          if (currentQueue.length === 0) {
            console.log("[Swap Engine] Queue already empty. End of sequence.");
            return;
          }
          
          const nextQueue = currentQueue.slice(1);
          const nextSwapper = nextQueue.length > 0 ? nextQueue[0] : null;

          console.log(`[Swap Engine] Advancing queue. Remain: ${nextQueue.length}. Next: ${nextSwapper?.nickname || "None"}`);

          const newOptions = {
            ...(gameRef.current.options || {}),
            swapState: {
              queue: nextQueue,
              currentSwapperId: nextSwapper?.id || null,
              currentSwapperNickname: nextSwapper?.nickname || null
            }
          };

          await supabase.from("games")
            .update({ options: newOptions })
            .eq("id", gameRef.current.id);

          // Update state and REFS
          setSwapQueue(nextQueue);
          setCurrentSwapperId(nextSwapper?.id || null);
          swapQueueRef.current = nextQueue;
          currentSwapperIdRef.current = nextSwapper?.id || null;

          if (nextSwapper) {
            console.log(`[Swap Engine] Broadcasting START_SWAP for next student: ${nextSwapper.nickname}`);
            setTimeout(async () => {
              await channel.send({
                type: 'broadcast',
                event: 'START_SWAP',
                payload: { playerId: nextSwapper.id, nickname: nextSwapper.nickname }
              });
            }, 800);
          }
        };

        if (!swapper) {
          console.error(`[Swap Engine] Fatal: Swapper ${swapperId} not found.`);
          await advanceQueue();
          return;
        }

        // 2. Handle Skip
        if (!targetId) {
          console.log(`[Swap Engine] Swapper ${swapper.nickname} chose to SKIP.`);
          await channel.send({
            type: 'broadcast',
            event: 'SWAP_COMPLETED',
            payload: { swapperId, swapperName: swapper.nickname, targetId: null, targetName: null, skipped: true }
          });
        } else {
          // 3. Handle Swap
          const { data: target } = await supabase.from('players').select('score, nickname, buffs').eq('id', targetId).single();
          if (!target) {
            console.warn(`[Swap Engine] Target ${targetId} not found. Advancing...`);
          } else {
            const targetHasShield = target.buffs?.includes('SHIELD');
            if (targetHasShield) {
              const newBuffs = target.buffs.filter((b: string) => b !== 'SHIELD');
              await supabase.from('players').update({ buffs: newBuffs }).eq('id', targetId);
              await channel.send({ type: 'broadcast', event: 'SHIELD_BLOCK', payload: { nickname: target.nickname, type: 'swap' } });
            } else {
              const { error: err1 } = await supabase.from('players').update({ score: target.score }).eq('id', swapperId);
              const { error: err2 } = await supabase.from('players').update({ score: swapper.score }).eq('id', targetId);
              
              if (err1 || err2) {
                console.error("[Swap Engine] Score update FAILED:", { swapperErr: err1, targetErr: err2 });
              } else {
                console.log(`[Swap Engine] SUCCESS: Swapped ${swapper.nickname} (${target.score}) with ${target.nickname} (${swapper.score})`);
              }

              await channel.send({
                type: 'broadcast',
                event: 'SWAP_COMPLETED',
                payload: { 
                  swapperId, swapperName: swapper.nickname, 
                  targetId, targetName: target.nickname,
                  swapperScore: target.score, targetScore: swapper.score,
                  skipped: false
                }
              });
            }
          }
        }

        // 4. Mark as consumed
        try {
          const swapperInQueue = (swapQueueRef.current || []).find(s => String(s.id) === String(swapperId));
          const targetAnswerId = swapperInQueue?.answerId;
          if (targetAnswerId) {
            const { data: currentAns } = await supabase.from('answers').select('event').eq('id', targetAnswerId).single();
            if (currentAns?.event?.includes('swap')) {
              const newEvent = currentAns.event.split(',').map((e: string) => e.trim() === 'swap' ? 'swap_done' : e).join(',');
              await supabase.from('answers').update({ event: newEvent }).eq('id', targetAnswerId);
            }
          }
        } catch (e) {
          console.error("[Swap Engine] Consumption error:", e);
        }

        // 5. GO!
        await advanceQueue();
        
        // 6. Refresh states to update UI
        if (refreshPlayers) {
          console.log("[Swap Engine] Refreshing players state...");
          await refreshPlayers();
        }

        const { data: updatedAns } = await supabase.from("answers")
          .select("*")
          .eq("game_id", game.id)
          .eq("q_index", gameRef.current.current_q_index);
        if (updatedAns) setAnswers(updatedAns);
        
        console.log("[Swap Engine] Step finished.");
      })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  useEffect(() => {
    if (game.status === 'RESULT' || game.status === 'PLAYING') {
      setCalculating(false);
    }
    // RESET SWAP & SUBMISSION STATES when moving to a new turn or re-starting play
    if (game.status === 'PLAYING') {
      setCurrentSwapperId(null);
      setSwapQueue([]);
      setAnswers([]); // CRITICAL: Reset submission status for the new question
    }
  }, [game.status, game.current_q_index]);

  useEffect(() => {
    if (game.status === 'RESULT') {
      setShowLargeAnswer(true);
      const timer = setTimeout(() => setShowLargeAnswer(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowLargeAnswer(false);
    }
  }, [game.status, game.current_q_index]);

  useEffect(() => {
    if (game.status !== 'PLAYING') return;
    const limit = currentQuestion?.timeLimit || 20;
    setTimeLeft(limit);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => { if (finishRoundRef.current) finishRoundRef.current(); }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [game.id, game.current_q_index, game.status]);

  useEffect(() => {
    const channel = supabase
      .channel(`answers:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `game_id=eq.${game.id}` }, 
      async () => {
        // CRITICAL PROTECTION: Do not overwrite Host results with DB updates while in RESULT mode OR calculating.
        // We calculate locally to ensure immediate icons/points; DB sync is for late-comers or refreshes.
        if (gameRef.current.status !== 'RESULT' && !calculating) {
          const { data } = await supabase.from("answers").select("*").eq("game_id", game.id).eq("q_index", gameRef.current.current_q_index);
          if (data) setAnswers(data);
        }
      }).subscribe();

    const fetchAnswers = async () => {
      // If we're entering a new question in PLAYING mode, start fresh
      if (gameRef.current.status === 'PLAYING' && !calculating) {
        const { data } = await supabase.from("answers").select("*").eq("game_id", game.id).eq("q_index", gameRef.current.current_q_index);
        if (data) setAnswers(data);
      }
      // Note: We DO NOT poll during RESULT mode anymore because HostControl has already 
      // computed the final results locally. Polling risks overwriting them with stale
      // DB data if the update failed or was delayed.
    };
    
    fetchAnswers();
    const interval = setInterval(() => {
       if (gameRef.current.status === 'PLAYING' && !calculating) fetchAnswers();
    }, 2000);
    
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [game.id, game.current_q_index]);


  // 4. Final Early Return Correct Placement
  if (game.status === 'ENDED') return null;

  if (game.status === 'RESULT') {
    return (
      <div className="h-screen w-full flex flex-col bg-indigo-900 text-white overflow-hidden relative">
        {/* Large Answer Popup Overlay */}
        {showLargeAnswer && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-indigo-900 animate-in fade-in duration-300">
            <div className="flex flex-col items-center animate-in zoom-in duration-500 text-center p-8">
               <div className="bg-white/10 text-indigo-200 px-8 py-2 rounded-full font-black text-xl mb-8 uppercase tracking-widest border border-white/10">
                 Correct Answer
               </div>
                <div className="text-[8rem] md:text-[12rem] font-black text-yellow-300 drop-shadow-[0_20px_50px_rgba(253,224,71,0.3)] leading-none font-jua [&_p]:m-0">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{processMathText(currentQuestion?.a || "")}</ReactMarkdown>
                </div>
               <div className="mt-12 w-32 h-2 bg-yellow-400/20 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 animate-loading-bar" />
               </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="h-screen w-full flex flex-col bg-indigo-900 text-white overflow-hidden">
          {/* Header Section: Results & Question Info */}
          <div className="shrink-0 pt-8 px-8 pb-4 flex flex-col items-center border-b border-white/5 bg-indigo-900/50 backdrop-blur-md relative z-10">
            {/* Game Entry Code */}
            <div className="absolute top-4 left-8 flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-xl border border-white/20">
              <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">CODE</span>
              <span className="text-xl font-black text-white tracking-wider font-mono">{game.code}</span>
            </div>

            <div className="absolute top-4 right-8 no-print">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-white/40 hover:text-red-400 hover:bg-white/5" 
                onClick={handleExitGame}
                disabled={calculating}
              >
                <LogOut size={16} className="mr-2" /> 게임 종료
              </Button>
            </div>

            <div className="flex items-center gap-4 mb-2">
              <Award size={48} className="text-yellow-400 animate-bounce" />
              <h2 className="text-3xl font-jua">라운드 결과</h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full max-w-6xl justify-center">
              <div className="bg-white/10 px-8 py-3 rounded-2xl border-2 border-white/10 animate-pop text-center">
                <span className="text-indigo-200 font-bold mb-1 uppercase tracking-widest text-[10px] block">정답</span>
                <h3 className="text-3xl font-black text-yellow-300 [&_p]:m-0">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{processMathText(currentQuestion?.a || "")}</ReactMarkdown>
                </h3>
              </div>
              
              <div className="flex gap-3">
                 <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/5 text-center min-w-[100px]">
                    <div className="text-[10px] font-bold opacity-50 uppercase">정답자</div>
                    <div className="text-2xl font-black text-green-400">{answers.filter(a => a.is_correct).length}명</div>
                 </div>
                 <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/5 text-center min-w-[100px]">
                    <div className="text-[10px] font-bold opacity-50 uppercase">참여도</div>
                    <div className="text-2xl font-black text-blue-300">{players.length > 0 ? Math.round((answers.length / players.length) * 100) : 0}%</div>
                 </div>
              </div>

              {/* Team Scores Mini List */}
              {(() => {
                const teamScores: Record<string, number> = {};
                players.forEach(p => {
                  if (p.team) {
                    teamScores[p.team] = (teamScores[p.team] || 0) + p.score;
                  }
                });
                
                if (Object.keys(teamScores).length > 0) {
                  const teamColors: Record<string, string> = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-green-500', YELLOW: 'bg-yellow-400' };
                  return (
                    <div className="flex gap-2">
                      {Object.entries(teamScores).sort((a,b) => b[1] - a[1]).map(([team, score]) => (
                        <div key={team} className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 flex flex-col items-center">
                          <span className={cn("inline-block w-2 h-2 rounded-full mb-1", teamColors[team])} />
                          <span className="text-xs font-black text-white">{score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          
          {/* Scrollable Middle: Participant Rankings */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col items-center mb-6">
                <h3 className="text-xl font-jua text-indigo-200">🏆 실시간 실적 리스트</h3>
                <div className="h-1 w-12 bg-indigo-500 rounded-full mt-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {players.map((player, idx) => {
                  const ans = answers.find(a => a.player_id === player.id);
                  
                  const getEventInfo = (event?: string) => {
                    if (!event || event === 'none') return null;
                    const e = event.trim().toLowerCase();
                    if (e === 'double') return { icon: '✨', text: '두배' };
                    if (e === 'strike_bonus') return { icon: '🔥', text: '콤보' };
                    if (e === 'strike_double') return { icon: '💥', text: '슈퍼' };
                    if (e === 'swap') return { icon: '🔄', text: '교체' };
                    if (e === 'strike') return { icon: '⚡', text: '콤보+' };
                    if (e === 'shield') return { icon: '🛡️', text: '방어' };
                    if (e === 'cut') return { icon: '✂️', text: '삭감' };
                    if (e === 'donate') return { icon: '🎁', text: '기부' };
                    if (e.startsWith('gift')) return { icon: '🎁', text: '선물' };
                    if (e.endsWith('_blocked')) return { icon: '🛡️', text: '방어' };
                    return null;
                  };

                  return (
                    <div 
                      key={player.id} 
                      className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group shrink-0"
                    >
                      {/* Rank Indication */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-lg",
                        idx === 0 ? "bg-yellow-400 text-indigo-900 border-2 border-yellow-200" : 
                        idx === 1 ? "bg-slate-300 text-slate-700" :
                        idx === 2 ? "bg-orange-400 text-white" : "bg-white/10 text-white"
                      )}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="flex flex-col min-w-0 max-w-[120px]">
                          <span className="text-lg font-black truncate">{player.nickname}</span>
                          {player.team && (
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5",
                              player.team === 'RED' ? 'text-red-400' :
                              player.team === 'BLUE' ? 'text-blue-400' :
                              player.team === 'GREEN' ? 'text-green-400' : 'text-yellow-400'
                            )}>
                              {player.team === 'RED' ? '빨강팀' : player.team === 'BLUE' ? '파랑팀' : player.team === 'GREEN' ? '초록팀' : '노랑팀'}
                            </span>
                          )}
                        </div>

                        {/* Effects */}
                        <div className="flex items-center gap-1 shrink-0 px-2 border-l border-white/10">
                          {ans?.event && ans.event !== 'none' ? (
                            ans.event.split(',').slice(0, 2).map((e: string, eIdx: number) => {
                              const evt = getEventInfo(e);
                              if (!evt) return null;
                              return (
                                <div key={eIdx} className={cn(
                                  "flex flex-col items-center bg-white/10 px-1.5 py-0.5 rounded-lg border border-white/5",
                                  String(currentSwapperId) === String(player.id) && e === 'swap' && "bg-indigo-600 border-indigo-400 scale-110 shadow-lg ring-2 ring-white/20"
                                )}>
                                  {String(currentSwapperId) === String(player.id) && e === 'swap' ? (
                                    <RefreshCw className="text-white animate-spin" size={12} />
                                  ) : (
                                    <span className="text-sm leading-none drop-shadow-md">{evt.icon}</span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-dashed border-white/5" />
                          )}
                        </div>

                        {/* Submission Content */}
                        <div className="flex-1 min-w-0">
                          {ans && (
                            <div className={cn(
                              "w-full px-3 py-1 rounded-xl font-bold text-xs text-center border truncate [&_p]:m-0",
                              ans.is_correct 
                                ? "bg-emerald-500/80 border-emerald-400/50 text-white" 
                                : "bg-red-500/80 border-red-400/50 text-white"
                            )}>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                                {processMathText(ans.answer || '(미입력)')}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="min-w-[70px] text-right font-black shrink-0 pr-1">
                        <div className="text-xl text-yellow-400 tabular-nums">
                          {player.score.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="h-4" />
            </div>
          </div>

          {/* Footer Section: Navigation & Controls */}
          <div className="shrink-0 p-6 bg-indigo-900 border-t border-white/10 flex flex-col items-center gap-3 relative z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.3)]">
            <Button 
              size="xl" 
              className={cn(
                "px-16 py-6 font-black shadow-2xl rounded-[2rem] text-xl group transition-all min-w-[320px]",
                currentSwapperId ? "bg-slate-500 text-slate-100 cursor-not-allowed" : "bg-yellow-400 text-indigo-900 hover:bg-yellow-300 hover:scale-105"
              )}
              onClick={handleNextQuestion}
              disabled={!!currentSwapperId}
            >
              {currentSwapperId ? (
                <span className="flex items-center gap-3">
                  <RefreshCw className="animate-spin" size={24} /> 점수 교체 진행 중...
                </span>
              ) : (
                <>
                  {game.current_q_index >= (game.options?.questions?.length || 1) - 1 ? (
                    <><Trophy className="mr-2" size={24} /> 최종 결과 발표 보기</>
                  ) : (
                    <>다음 문제로 <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </>
              )}
            </Button>
            
            <div className="flex items-center gap-6">
              <div className="text-indigo-300 text-xs font-bold">
                 참여 인원: <span className="text-white">{players.length}명</span>
              </div>
              {currentSwapperId && (
                <button 
                  onClick={handleForceNext}
                  className="flex items-center gap-1.5 text-red-300/60 hover:text-red-300 font-bold transition-all text-[11px] border-b border-transparent hover:border-red-400"
                >
                  <AlertCircle size={12} /> 강제로 다음 이동하기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Current Question Display */}
      <div className="bg-white p-10 shadow-xl relative z-10 border-b-8 border-indigo-200 shrink-0">
        {/* Game Entry Code */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">CODE</span>
          <span className="text-2xl font-black text-indigo-900 tracking-wider font-mono">{game.code}</span>
        </div>

        {/* Exit Button */}
        <div className="absolute top-4 right-4 no-print">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-red-500 hover:bg-red-50" 
            onClick={handleExitGame}
            disabled={calculating}
          >
            <LogOut size={18} className="mr-2" /> 게임 종료
          </Button>
        </div>
        
          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-6 py-2 rounded-full font-black text-xl mb-6">
              <HelpCircle size={24} /> Question #{game.current_q_index + 1}
            </div>
            <div className="flex flex-col items-center gap-1 mb-8">
               <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Points</span>
               <span className="bg-emerald-500 text-white px-6 py-1 rounded-2xl text-2xl font-black shadow-lg shadow-emerald-100 italic">
                 {currentQuestion?.points || 10}점
               </span>
            </div>

            {currentQuestion?.type === "BLANK" ? (
              <div className="flex flex-col items-center gap-6 mb-8">
                <span className="text-2xl font-black text-indigo-400">다음 빈칸에 알맞은 글자를 넣으세요.</span>
                <div className="p-8 bg-slate-50 rounded-[3rem] border-4 border-slate-100 flex flex-wrap gap-x-2 gap-y-8 items-center justify-center shadow-inner">
                  {currentQuestion.q.split(/\s+/).filter(Boolean).map((word: string, wordIdx: number) => {
                    const blanks = currentQuestion.blanks || [];
                    const isBlank = blanks.includes(wordIdx);
                    
                    if (isBlank) {
                      return (
                        <div key={wordIdx} className="flex gap-1 bg-white p-2 rounded-2xl shadow-sm border-2 border-slate-200">
                          {Array.from({ length: word.length }).map((_, i) => (
                            <div key={i} className={cn(
                              "w-12 h-14 rounded-xl flex items-center justify-center font-black text-2xl transition-all",
                              game.current_hint_stage >= 1 
                                ? "bg-indigo-600 text-white shadow-indigo-100 scale-110" 
                                : "bg-slate-50 border-2 border-indigo-100 text-indigo-200"
                            )}>
                              {game.current_hint_stage >= 1 ? getChoseong(word[i]) : ""}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return <span key={wordIdx} className="text-3xl font-black text-slate-400 px-2">{word}</span>;
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 mb-8 w-full px-4">
                <div className={cn(
                  "font-black text-gray-800 break-keep leading-tight text-center w-full [&_p]:m-0",
                  "text-5xl md:text-7xl"
                )}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{processMathText(currentQuestion?.q || "")}</ReactMarkdown>
                </div>

                {/* Question Options for Teacher (Simplified & Hidden Answer) */}
                {(currentQuestion?.type === "MULTIPLE_CHOICE" || currentQuestion?.type === "OX") && (
                  <div className="grid grid-cols-2 gap-4 w-full max-w-3xl mt-2">
                    {(currentQuestion.options || []).map((opt: string, i: number) => (
                      <div 
                        key={i} 
                        className="p-5 rounded-3xl border-4 bg-white border-slate-100 text-slate-600 text-xl font-black text-left flex items-center gap-4 transition-all shadow-md opacity-80"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 text-lg">
                          {i + 1}
                        </div>
                        <div className="break-all line-clamp-2 [&_p]:m-0 flex-1">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                            {processMathText(opt)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {game.current_hint_stage > 0 && currentQuestion?.type === "SHORT_ANSWER" && (
                  <div className="flex flex-wrap justify-center gap-3 animate-in slide-in-from-top-2 duration-300">
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
            )}

            <div className="flex flex-wrap justify-center gap-6 mt-6 items-center">
              {currentQuestion?.type !== "MULTIPLE_CHOICE" && currentQuestion?.type !== "OX" && !currentQuestion?.math_mode && (
                <div className="flex bg-slate-100 p-2 rounded-2xl gap-2">
                  {currentQuestion?.type === "BLANK" ? (
                    <button
                      onClick={() => handleHintStage(1)}
                      className={cn(
                        "px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                        game.current_hint_stage >= 1 
                          ? "bg-indigo-600 text-white shadow-lg" 
                          : "text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      <Zap size={18} className={game.current_hint_stage >= 1 ? "fill-white" : ""} />
                      초성 힌트 공개
                    </button>
                  ) : (
                    [1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleHintStage(s)}
                        className={cn(
                          "px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                          game.current_hint_stage >= s 
                            ? "bg-indigo-600 text-white shadow-lg" 
                            : "text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        <Zap size={18} className={game.current_hint_stage >= s ? "fill-white" : ""} />
                        {s === 1 ? "1단계: 글자수" : "2단계: 초성"}
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="h-10 w-px bg-slate-200" />

              <div className="flex items-center gap-6 bg-slate-50 px-8 py-4 rounded-3xl border-2 border-slate-100 shadow-sm font-black text-indigo-600 text-2xl">
                 <div className={cn(
                   "flex items-center gap-3 transition-all duration-300",
                   timeLeft <= 5 && "text-red-500 animate-pulse scale-110"
                 )}>
                   <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors bg-indigo-100">
                     <Clock size={28} />
                   </div>
                   {timeLeft}s
                 </div>
              </div>
            </div>
          </div>
        </div>

      {/* Progress Bar */}
      <div className="h-4 bg-gray-200 w-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-1000" 
          style={{ width: `${(answers.length / players.length) * 100}%` }}
        ></div>
      </div>

      {/* Student Status Grid */}
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-jua text-gray-700">제출 현황 ({answers.length}/{players.length})</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-sm font-black text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                <CheckCircle2 size={16} /> 제출 완료
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                <AlertCircle size={16} /> 대기 중
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pb-20">
            {players.map(player => {
              const answer = answers.find(a => a.player_id === player.id);
              const isTimeout = answer?.answer === '(시간초과)';
              const hasSubmitted = !!answer && !isTimeout;
              
              return (
                <div 
                  key={player.id}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2",
                    hasSubmitted ? 'bg-green-50 border-green-200 text-green-700 shadow-md scale-105' : 
                    isTimeout ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' :
                    'bg-white border-gray-100 text-gray-300'
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-black",
                    hasSubmitted ? 'bg-green-600 text-white' : 
                    isTimeout ? 'bg-red-600 text-white' :
                    'bg-gray-100 text-gray-300'
                  )}>
                    {player.nickname[0]}
                  </div>
                  <span className="text-xs font-bold truncate w-full text-center">{player.nickname}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Footer Container */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col pointer-events-none">
        {/* Main Footer Controls */}
        <div className="bg-white/95 backdrop-blur-md border-t-2 border-indigo-100 p-4 md:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 text-indigo-700 p-3 md:p-4 rounded-2xl">
              <Users size={32} />
            </div>
            <div className="hidden sm:block">
              <div className="text-2xl font-black">{answers.length}명 제출</div>
              <div className="text-sm font-bold text-gray-400">남은 학생: {players.length - answers.length}명</div>
            </div>
          </div>
          
          <Button 
            size="xl" 
            disabled={calculating || game.status !== 'PLAYING'}
            className="px-8 md:px-16 py-6 md:py-8 bg-indigo-600 hover:bg-indigo-700 font-black shadow-xl rounded-2xl text-xl md:text-2xl transition-transform active:scale-95"
            onClick={handleFinishRound}
          >
            {calculating || game.status !== 'PLAYING' ? "채점 중..." : "문제 마감하기"}
          </Button>

          <div className="w-[100px] hidden md:block"></div> {/* Balanced spacing */}
        </div>

        {/* Player Status Bar */}
        <PlayerBar 
          players={players} 
          submissions={answers.filter(a => a.answer !== '(시간초과)').map(a => a.player_id)}
          className="bg-indigo-50/90 border-t border-indigo-200 pointer-events-auto"
        />
      </div>
    </div>
  );
}
