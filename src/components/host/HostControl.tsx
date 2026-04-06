"use client";
import React from "react";

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
import { cn, getChoseong, processMathText, normalizeMath } from "@/lib/utils";
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

const processAnswers = (data: any[]) => {
  const map = new Map();
  data.forEach((a: any) => map.set(a.player_id, a));
  return Array.from(map.values()).filter((a: any) => a.answer !== '(retracted)');
};

export function HostControl({ game, players, refreshPlayers }: HostControlProps) {
  const [answers, setAnswers] = useState<any[]>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [swapQueue, setSwapQueue] = useState<any[]>([]);
  const [currentSwapperId, setCurrentSwapperId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30); // Default
  const [showLargeAnswer, setShowLargeAnswer] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
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
      const remaining = playersRef.current.length - answersRef.current.length;
      const confirmed = await showConfirm({
        message: "아직 제출하지 않은 학생이 있습니다.",
        description: `${remaining}명의 학생이 정답을 제출하지 않았습니다. 정말 마감할까요?`,
        confirmLabel: "마감하기",
        cancelLabel: "더 기다리기"
      });
      if (!confirmed) return;
    }

    setCalculating(true);

    try {
      setCalculating(true);

      // Safety delay reduced to 200ms to allow late student submissions to propagate to DB
      // 500ms was causing perceived lag
      await new Promise(resolve => setTimeout(resolve, 200));

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
      const currentAnswers = processAnswers(freshAnswers || []);
      const currentPlayers = playersRef.current;

      // 2. Calculate base results
      const calculatedResults = currentPlayers.map((player: any) => {
        const answer = currentAnswers.find((a: any) => a.player_id === player.id);

        // Calculate correctness locally based on question type
        let isCorrect = false;
        if (answer?.answer) {
          if (question.type === "OX") {
            isCorrect = answer.answer.toUpperCase() === question.a.toUpperCase();
          } else if (question.type === "MULTIPLE_CHOICE") {
            // Compare normalized strings for multiple choice
            isCorrect = normalizeMath(answer.answer) === normalizeMath(question.a);
          } else {
            // Short answer or Blank: normalize both and compare
            isCorrect = normalizeMath(answer.answer) === normalizeMath(question.a);
          }
        }
        let basePoints = question.points || 10;
        let points = 0;
        let event = 'none';

        const options = game.options || {};
        const probs = options.probabilities || { double: 5, swap: 5, strike: 5, shield: 5, cut: 5, donate: 5 };
        const p = (key: string) => {
          // If the effect is explicitly disabled in options, probability is 0
          if (options[key] === false) return 0;
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

          // Independent chances for each item, only if enabled in options
          if (options.double !== false && Math.random() < p('double')) {
            points *= 2;
            acquiredEvents.push('double');
          }
          if (options.swap !== false && Math.random() < p('swap')) acquiredEvents.push('swap');
          if (options.strike !== false && Math.random() < p('strike')) acquiredEvents.push('strike');
          if (options.shield !== false && Math.random() < p('shield')) acquiredEvents.push('shield');

          if (acquiredEvents.length === 0) event = 'none';
          else {
            event = acquiredEvents.join(',');
          }
        } else {
          // Negative effects (Independent chance too, only if enabled)
          const negativeEvents: string[] = [];

          if (options.cut !== false && Math.random() < p('cut')) negativeEvents.push('cut');
          if (options.donate !== false && Math.random() < p('donate')) negativeEvents.push('donate');

          if (negativeEvents.length > 0) {
            let currentBuffs = [...(player.buffs || [])];
            const finalNegEvents = negativeEvents.map(evt => {
              if (currentBuffs.includes('SHIELD')) {
                currentBuffs = currentBuffs.filter(b => b !== 'SHIELD');
                return evt + '_blocked';
              }
              if (evt === 'cut') points -= basePoints;
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

      // 3. Speed Bonus Calculation (Top 3 correct submitters)
      const correctSubmissions = currentAnswers
        .filter(a => {
          const question = currentGame.options?.questions[qIndex];
          return normalizeMath(a.answer) === normalizeMath(question.a);
        })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const speedBonuses = new Map<string, number>();
      if (correctSubmissions.length > 0) speedBonuses.set(correctSubmissions[0].player_id, 5);
      if (correctSubmissions.length > 1) speedBonuses.set(correctSubmissions[1].player_id, 3);
      if (correctSubmissions.length > 2) speedBonuses.set(correctSubmissions[2].player_id, 1);

      // 4. Integrated Scoring Loop (Base + Speed + Streak)
      const resultsWithBonuses = calculatedResults.map((res: any) => {
        let additionalPoints = 0;
        const bonusEvents: string[] = [];

        // Speed Bonus
        const sBonus = speedBonuses.get(res.player.id) || 0;
        if (sBonus > 0) {
          additionalPoints += sBonus;
          bonusEvents.push(`speed:${sBonus}`);
        }

        // Streak Bonus
        let newStreak = 0;
        let stBonus = 0;
        if (res.isCorrect) {
          newStreak = (res.player.answer_streak || 0) + 1;
          if (newStreak === 3) stBonus = 5;
          else if (newStreak === 5) stBonus = 10;
          else if (newStreak === 10) stBonus = 20;

          if (stBonus > 0) {
            additionalPoints += stBonus;
            bonusEvents.push(`streak:${newStreak}:${stBonus}`);
          }
        } else {
          newStreak = 0;
        }

        const finalPoints = res.points + additionalPoints;
        const finalEvent = res.event === 'none' 
          ? (bonusEvents.length > 0 ? bonusEvents.join(',') : 'none')
          : (bonusEvents.length > 0 ? res.event + ',' + bonusEvents.join(',') : res.event);

        return {
          ...res,
          points: finalPoints,
          event: finalEvent,
          newStreak,
          speedBonus: sBonus,
          streakBonus: stBonus
        };
      });

      // 5. Identification of Swap Earners (using order from base results)
      const swappers = resultsWithBonuses
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
        .sort((a, b) => b.submitted_at - a.submitted_at);

      // Handle Donation BEFORE creating final arrays
      calculatedResults.forEach(res => {
        if (res.event.includes('donate')) {
          const donorNick = res.player.nickname;
          const donorTeam = res.player.team;

          // Find candidates: correct answer, NOT the donor, and NOT donor's teammate (if team mode)
          const candidates = calculatedResults.filter((r: any) => {
            if (!r.isCorrect) return false;
            if (r.player.id === res.player.id) return false;
            // Team mode exclusion
            if (game.options?.isTeamMode && donorTeam && r.player.team === donorTeam) return false;
            return true;
          });

          if (candidates.length > 0) {
            // Pick up to 3 random candidates
            const targets = candidates.sort(() => 0.5 - Math.random()).slice(0, 3);

            // Donor loses 10 points per recipient
            res.points -= (10 * targets.length);

            targets.forEach((t: any) => {
              // Each target gains 10 points
              t.points += 10;
              const donorInfo = `gift:${donorNick}`;
              if (t.event === 'none') {
                t.event = donorInfo;
              } else {
                // Append to existing events (comma-separated)
                t.event = t.event + `,${donorInfo}`;
              }
            });
          } else {
            // No correct answers to donate to? Remove donate from events
            res.event = res.event.split(',').filter((e: string) => e !== 'donate').join(',') || 'none';
          }
        }
      });

      const finalResults = [...resultsWithBonuses];

      // Update local answers state immediately so UI updates
      const updatedAnswers = finalResults.map((res: any) => ({
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
            buffs: res.newBuffs,
            answer_streak: res.newStreak
          })
          .eq('id', res.player.id);
        if (error) console.error("Player update failed for", res.player.nickname, error);
      });

      // Run DB updates in parallel for better performance
      await Promise.all([
        ...answerPromises,
        ...playerPromises
      ]);

      // 4. Handle Broadcasts (Shield Block, etc.)
      const blockedResults = finalResults.filter((r: any) => r.event.includes('_blocked'));
      if (blockedResults.length > 0) {
        const eventChannel = supabase.channel(`game_swaps_${game.id}`);
        eventChannel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            for (const res of blockedResults) {
              const blockedTypes = res.event.split(',').filter((e: string) => e.endsWith('_blocked'));
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

      // 6. Update Game Status & Initial Swap State in DB (Done OUTSIDE subscription for reliability)
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

      // CRITICAL: Update DB status to RESULT immediately
      const { error: statusErr } = await supabase.from("games")
        .update({
          status: "RESULT",
          options: newOptions
        })
        .eq("id", game.id);
      
      if (statusErr) console.error("[Host] Status update failed:", statusErr);

      // 7. Broadcast Results Ready (to trigger student re-fetch)
      const eventChannel = supabase.channel(`game_events_${game.id}`);
      eventChannel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log("[Host] Broadcasting results and updates...");
          
          await eventChannel.send({
            type: 'broadcast',
            event: 'ROUND_RESULTS_READY',
            payload: { q_index: qIndex, results: updatedAnswers }
          });

          await eventChannel.send({
            type: 'broadcast',
            event: 'GAME_UPDATE',
            payload: { status: "RESULT", q_index: qIndex }
          });

          if (swappers.length > 0) {
            console.log("[Host] Broadcasting FIRST swap start:", swappers[0].nickname);
            await eventChannel.send({
              type: 'broadcast',
              event: 'START_SWAP',
              payload: { playerId: String(swappers[0].id), nickname: swappers[0].nickname }
            });
          }

          // Update local state and ref so host UI shows the icons/results immediately
          setAnswers(updatedAnswers);
          answersRef.current = updatedAnswers;

          setTimeout(() => supabase.removeChannel(eventChannel), 5000);
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
      // Reduced final settle timeout from 2000ms to 800ms
      setTimeout(() => setCalculating(false), 800);
    }
  };

  const handleForceNext = async () => {
    const confirmed = await showConfirm({ message: "누군가 점수를 바꾸고 있어요. 그래도 다음으로 넘어갈까요?" });
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
    const nextStatus = isLast ? "ENDED" : "PLAYING";
    const nextIndex = isLast ? game.current_q_index : game.current_q_index + 1;
    
    // Add start timestamp to options for timer sync and CLEAR any lingering swapState
    const nextOptions = {
      ...(game.options || {}),
      current_q_started_at: nextStatus === "PLAYING" ? new Date().toISOString() : null,
      swapState: null // Clear swap state for the next question
    };

    const { error } = await supabase
      .from("games")
      .update({
        status: nextStatus,
        current_q_index: nextIndex,
        current_hint_stage: 0,
        options: nextOptions
      })
      .eq("id", game.id);

    if (error) {
      await showAlert({ message: "이동 실패: " + error.message });
      throw error;
    }

    // BROADCAST immediate refresh for all players to move to new question
    const channel = supabase.channel(`game_realtime:${game.id}`);
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'GAME_UPDATE',
          payload: { status: nextStatus, q_index: nextIndex }
        });
        setTimeout(() => supabase.removeChannel(channel), 2000);
      }
    });
  };

  const handleExitGame = async () => {
    const confirmed = await showConfirm({ message: "여기까지 진행하고 최종 결과를 볼까요?" });
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
    let message = stage === 1 ? "힌트(글자 수)를 보여줄까요?" : "힌트(초성)를 보여줄까요?";
    const confirmed = await showConfirm({ message });
    if (!confirmed) return;

    const { error } = await supabase.from("games").update({ current_hint_stage: stage }).eq("id", game.id);
    if (!error) {
      // Broadcast hint reveal for immediate student-side reaction
      const channel = supabase.channel(`game_events_${game.id}`);
      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'HINT_REVEAL',
            payload: { stage }
          });
          // Do not close channel immediately if needed for other things, but here it's fine
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

  const [swapNotification, setSwapNotification] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  // Sequential Swap Listener
  const isSwappingRef = useRef(false);
  useEffect(() => {
    if (!game.id) return;

    const channel = supabase.channel(`game_events_${game.id}`)
      .on('broadcast', { event: 'EXECUTE_SWAP' }, async ({ payload }: { payload: any }) => {
        if (isSwappingRef.current) {
          console.log("[Host] Already processing a swap, ignoring duplicate broadcast.");
          return;
        }
        
        const { swapperId, targetId } = payload;
        console.log(`[Host] EXECUTE_SWAP received from ${swapperId} to ${targetId}`);
        
        isSwappingRef.current = true;

        const refreshAllData = async () => {
          if (refreshPlayers) await refreshPlayers();
          // Refetch submissions to update events and correct/wrong status shown on teacher UI
          const { data: latestAnswers } = await supabase
            .from('answers')
            .select('*')
            .eq('game_id', game.id)
            .eq('q_index', game.current_q_index);
          if (latestAnswers) setAnswers(latestAnswers);
        };

        const advanceQueue = async () => {
          try {
            const { data: freshGame } = await supabase.from('games').select('options').eq('id', game.id).single();
            const currentOptions = freshGame?.options || gameRef.current?.options || {};
            const currentQueue = currentOptions.swapState?.queue || swapQueueRef.current || [];
            
            if (currentQueue.length === 0) {
              isSwappingRef.current = false;
              return;
            }

            const nextQueue = currentQueue.slice(1);
            const nextSwapper = nextQueue.length > 0 ? nextQueue[0] : null;

            const newOptions = {
              ...currentOptions,
              swapState: {
                queue: nextQueue,
                currentSwapperId: nextSwapper?.id || null,
                currentSwapperNickname: nextSwapper?.nickname || null
              }
            };

            await supabase.from("games").update({ options: newOptions }).eq("id", game.id);

            setSwapQueue(nextQueue);
            setCurrentSwapperId(nextSwapper?.id || null);
            swapQueueRef.current = nextQueue;
            currentSwapperIdRef.current = nextSwapper?.id || null;

            // Broadcast status change immediately
            await channel.send({ type: 'broadcast', event: 'GAME_UPDATE', payload: { status: "RESULT" } });

            if (nextSwapper) {
              setTimeout(async () => {
                await channel.send({
                  type: 'broadcast',
                  event: 'START_SWAP',
                  payload: { playerId: String(nextSwapper.id), nickname: nextSwapper.nickname }
                });
              }, 1000);
            } else {
              console.log("[Host] All swaps completed.");
              await refreshAllData();
            }
          } catch (err) {
            console.error("[Host] Error advancing queue:", err);
          } finally {
            isSwappingRef.current = false;
          }
        };

        try {
          const { data: swapper } = await supabase.from('players').select('score, nickname').eq('id', swapperId).single();
          if (!swapper) { await advanceQueue(); return; }

          if (!targetId) {
            await channel.send({
              type: 'broadcast',
              event: 'SWAP_COMPLETED',
              payload: { swapperId, swapperName: swapper.nickname, targetId: null, targetName: null, skipped: true }
            });
          } else {
            const { data: target } = await supabase.from('players').select('score, nickname, buffs').eq('id', targetId).single();
            if (target) {
              if (target.buffs?.includes('SHIELD')) {
                const newBuffs = target.buffs.filter((b: string) => b !== 'SHIELD');
                await supabase.from('players').update({ buffs: newBuffs }).eq('id', targetId);
                await channel.send({ type: 'broadcast', event: 'SHIELD_BLOCK', payload: { nickname: target.nickname, type: 'swap' } });
                await channel.send({
                  type: 'broadcast',
                  event: 'SWAP_COMPLETED',
                  payload: { swapperId, swapperName: swapper.nickname, targetId, targetName: target.nickname, skipped: false, blocked: true }
                });
              } else {
                await supabase.from('players').update({ score: target.score }).eq('id', swapperId);
                await supabase.from('players').update({ score: swapper.score }).eq('id', targetId);
                await channel.send({
                  type: 'broadcast',
                  event: 'SWAP_COMPLETED',
                  payload: { swapperId, swapperName: swapper.nickname, targetId, targetName: target.nickname, swapperScore: target.score, targetScore: swapper.score, skipped: false }
                });
              }
            }
          }
          await refreshAllData();
          await advanceQueue();
          setSwapNotification({ message: "점수 교체가 완료되었습니다.", type: 'success' });
          setTimeout(() => setSwapNotification(null), 3000);
        } catch (err) {
          console.error("[Host] Error in swap processing:", err);
          isSwappingRef.current = false;
          await advanceQueue();
          setSwapNotification({ message: "교체 중 오류가 발생했습니다.", type: 'error' });
          setTimeout(() => setSwapNotification(null), 3000);
        }
      })
      .on('broadcast', { event: 'PLAYER_UPDATE' }, () => {
        if (refreshPlayers) refreshPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const prevQIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (game.status === 'RESULT' || game.status === 'PLAYING') {
      setCalculating(false);
    }
    // RESET SWAP & SUBMISSION STATES only when moving to a NEW question (PLAYING status)
    if (game.status === 'PLAYING' && prevQIndexRef.current !== game.current_q_index) {
      console.log(`[HostControl] New question detected (${game.current_q_index}), resetting states.`);
      setCurrentSwapperId(null);
      setSwapQueue([]);
      // Only clear answers if we're entering a state where new answers are expected.
      setAnswers([]);
      prevQIndexRef.current = game.current_q_index;
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

  // Removed showIntro logic - will start directly with question

  useEffect(() => {
    if (game.status !== 'PLAYING') {
      setTimeLeft(currentQuestion?.timeLimit || game.options?.timeLimit || 20);
      return;
    }

    const limit = currentQuestion?.timeLimit || game.options?.timeLimit || 20;
    const startedAt = game.options?.current_q_started_at;

    const syncTime = () => {
      let limit = currentQuestion?.timeLimit || game.options?.timeLimit || 20;
      
      if (!startedAt) return limit;
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      return Math.max(0, limit - elapsed);
    };

    // Initial sync
    const initialTime = syncTime();
    setTimeLeft(initialTime);

    const timer = setInterval(() => {
      const remaining = syncTime();
      setTimeLeft(remaining);
      
      // Periodically broadcast sync for all student clients to handle drift
      // Broadcast more frequently (every 2s) to ensure fast initial sync
      if (remaining > 0 && (remaining % 2 === 0 || remaining <= 3)) {
        const syncChannel = supabase.channel(`game_events_${game.id}`);
        syncChannel.send({
          type: 'broadcast',
          event: 'TIMER_SYNC',
          payload: { timeLeft: remaining }
        });
      }

      if (remaining <= 0) {
        clearInterval(timer);
        // Delay slightly to allow late submissions to trickle in
        setTimeout(() => { 
          if (finishRoundRef.current && gameRef.current.status === 'PLAYING') {
            finishRoundRef.current(); 
          }
        }, 1500);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [game.id, game.current_q_index, game.status, game.options?.current_q_started_at]);

  useEffect(() => {
    if (!game.id) return;

    const channel = supabase
      .channel(`answers:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `game_id=eq.${game.id}` },
        async (payload: any) => {
          // Optimization: Update local state incrementally to prevent perceived lag or missing updates
          if (gameRef.current.status === 'PLAYING' && !calculating) {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            setAnswers(prev => {
              if (eventType === 'INSERT') {
                // If it's a new answer and it matches the current question index
                if (newRecord.q_index === gameRef.current.current_q_index && newRecord.answer !== '(retracted)') {
                  const exists = prev.some((a: any) => a.player_id === newRecord.player_id);
                  if (exists) {
                    return prev.map((a: any) => a.player_id === newRecord.player_id ? newRecord : a);
                  }
                  return [...prev, newRecord];
                }
              } else if (eventType === 'UPDATE') {
                if (newRecord.q_index === gameRef.current.current_q_index) {
                  if (newRecord.answer === '(retracted)') {
                    return prev.filter((a: any) => a.player_id !== newRecord.player_id);
                  }
                  const exists = prev.some(a => a.player_id === newRecord.player_id);
                  if (exists) {
                    return prev.map((a: any) => a.player_id === newRecord.player_id ? newRecord : a);
                  }
                  return [...prev, newRecord];
                }
              } else if (eventType === 'DELETE') {
                return prev.filter((a: any) => a.id !== oldRecord.id);
              }
              return prev;
            });
          }
        }).subscribe();

    const fetchAnswers = async () => {
      // Fetch answers when PLAYING or in RESULT screen
      if ((gameRef.current.status === 'PLAYING' || gameRef.current.status === 'RESULT') && !calculating) {
        const { data } = await supabase.from("answers")
          .select("*")
          .eq("game_id", game.id)
          .eq("q_index", game.current_q_index);
        
        if (data) {
          const processed = processAnswers(data);
          setAnswers(processed);
          answersRef.current = processed;
        }
      }
    };

    // Optimization: avoid clearing answers if we just entered RESULT screen
    // so calculatedHost results don't flicker.
    if (gameRef.current.status === 'PLAYING') {
      setAnswers([]);
      answersRef.current = [];
    }
    fetchAnswers();

    const interval = setInterval(() => {
      if ((gameRef.current.status === 'PLAYING' || gameRef.current.status === 'RESULT') && !calculating) fetchAnswers();
    }, 2500); 

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(interval); 
    };
  }, [game.id, game.current_q_index, game.status]); 

  // Font Scaling Helpers for Host Screen
  const getHostQuestionFontSize = (text: string) => {
    const len = text.length;
    if (len > 200) return "text-lg md:text-xl";
    if (len > 100) return "text-xl md:text-2xl";
    if (len > 50) return "text-2xl md:text-4xl";
    return "text-4xl md:text-6xl";
  };

  const getHostOptionFontSize = (text: string) => {
    const len = text.length;
    if (len > 50) return "text-sm md:text-base";
    if (len > 30) return "text-base md:text-lg";
    return "text-lg md:text-xl";
  };


  // 4. Final Early Return Correct Placement
  if (game.status === 'ENDED') return null;

  if (game.status === 'RESULT') {
    return (
      <div className="h-screen w-full flex flex-col bg-indigo-900 text-white overflow-hidden relative">
        {/* Floating Emojis */}
        {floatingEmojis.map((e: any) => (
          <div key={e.id} className="absolute text-4xl animate-float-up z-[2000]" style={{ left: `${e.left}%`, bottom: '-50px' }}>
            {e.emoji}
          </div>
        ))}
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
              <Trophy size={64} className="text-yellow-400 drop-shadow-lg" />
              <h2 className="text-3xl font-jua">라운드 결과</h2>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full max-w-6xl justify-center">
              <div className="bg-white/10 px-8 py-3 rounded-2xl border-2 border-white/10 animate-pop text-center">
                <span className="text-indigo-200 font-bold mb-1 uppercase tracking-widest text-[10px] block">정답</span>
                <h3 className="text-3xl font-black text-yellow-300">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: 'span' }}
                  >
                    {processMathText(currentQuestion?.a || "")}
                  </ReactMarkdown>
                </h3>
              </div>

              <div className="flex gap-3">
                <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/5 text-center min-w-[100px]">
                  <div className="text-[10px] font-bold opacity-50 uppercase">정답자</div>
                  <div className="text-2xl font-black text-green-400">{answers.filter((a: any) => a.is_correct).length}명</div>
                </div>
                <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/5 text-center min-w-[100px]">
                  <div className="text-[10px] font-bold opacity-50 uppercase">참여도</div>
                  <div className="text-2xl font-black text-blue-300">{players.length > 0 ? Math.round((answers.length / players.length) * 100) : 0}%</div>
                </div>
              </div>

              {/* Team Scores Mini List */}
              {(() => {
                const teamData: Record<string, { score: number, members: any[] }> = {};
                players.forEach((p: any) => {
                  if (p.team) {
                    if (!teamData[p.team]) teamData[p.team] = { score: 0, members: [] };
                    teamData[p.team].score += p.score;
                    teamData[p.team].members.push(p);
                  }
                });

                if (Object.keys(teamData).length > 0) {
                  const teamColors: Record<string, string> = { RED: 'bg-red-500 shadow-red-500/50', BLUE: 'bg-blue-500 shadow-blue-500/50', GREEN: 'bg-green-500 shadow-green-500/50', YELLOW: 'bg-yellow-400 shadow-yellow-400/50' };
                  const teamNames: Record<string, string> = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' };
                  
                  return (
                    <div className="flex gap-2">
                      {Object.entries(teamData).sort((a, b) => b[1].score - a[1].score).map(([team, data]) => (
                        <div key={team} className="group relative bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 flex flex-col items-center hover:bg-white/10 transition-all cursor-default">
                          <span className={cn("inline-block w-2 h-2 rounded-full mb-1 shadow-sm", teamColors[team])} />
                          <span className="text-xs font-black text-white">{data.score.toLocaleString()}</span>
                          
                          {/* Team Members Tooltip */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 scale-95 group-hover:scale-100">
                            <div className="text-[9px] font-black text-white/40 mb-1.5 px-1 uppercase tracking-tighter border-b border-white/5 pb-1">{teamNames[team]} 팀원</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                              {data.members.sort((a, b) => b.score - a.score).map((m: any) => (
                                <div key={m.id} className="flex justify-between items-center px-1">
                                   <span className="text-[10px] font-bold text-white/80 truncate max-w-[70px]">{m.nickname}</span>
                                   <span className="text-[10px] font-black text-indigo-400">{m.score.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-32 pb-20">
                {[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((player: any, idx: number, sortedPlayers: any[]) => {
                  const ans = answers.find((a: any) => a.player_id === player.id);
                  let rank = idx + 1;
                  if (idx > 0 && (player.score || 0) === (sortedPlayers[idx - 1].score || 0)) {
                    rank = sortedPlayers.findIndex(p => (p.score || 0) === (player.score || 0)) + 1;
                  }

                  const getEventInfo = (event?: string) => {
                    if (!event || event === 'none') return null;
                    const e = event.trim().toLowerCase();
                    
                    if (e.startsWith('speed:')) return { icon: '🚀', text: '선착순', desc: '가장 빠르게 정답을 맞춘 학생에게 주는 보너스 점수입니다!' };
                    if (e.startsWith('streak:')) {
                      const count = e.split(':')[1];
                      return { icon: '🔥', text: `${count}연속`, desc: `${count}번 연속으로 정답을 맞췄을 때 주는 보너스 점수입니다!` };
                    }

                    if (e === 'double') return { icon: '✨', text: '두배', desc: '행운의 찬스! 다음 문제에서 정답 시 획득하는 점수가 2배가 됩니다!' };
                    if (e === 'strike_bonus') return { icon: '🔥', text: '콤보', desc: '연속 정답 보너스가 적용되었습니다!' };
                    if (e === 'strike_double') return { icon: '💥', text: '슈퍼', desc: '강력한 콤보 보너스가 적용되었습니다!' };
                    if (e === 'swap') return { icon: '🔄', text: '교체', desc: '다른 친구 중 한 명과 내 점수를 바꿀 수 있는 기회입니다!' };
                    if (e === 'strike') return { icon: '⚡', text: '콤보+', desc: '다음 문제 정답 시 추가 보너스를 획득할 수 있습니다!' };
                    if (e === 'shield') return { icon: '🛡️', text: '방어', desc: '상대방의 점수 삭감 공격을 1회 방어할 수 있는 방어막을 얻었습니다!' };
                    if (e === 'cut') return { icon: '✂️', text: '삭감', desc: '가장 높은 점수의 학생의 점수를 일부 삭감시켰습니다!' };
                    if (e === 'donate') return { icon: '📤', text: '기부', desc: '내 정답 점수의 일부를 다른 모든 친구들에게 나누어 주었습니다!' };
                    if (e.startsWith('gift')) return { icon: '🎁', text: '선물', desc: '다른 친구로부터 깜짝 점수 선물을 받았습니다!' };
                    if (e.endsWith('_blocked')) return { icon: '🛡️', text: '방어 성공', desc: '방어막 아이템을 사용하여 상대방의 공격을 성공적으로 막아냈습니다!' };
                    return null;
                  };

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group shrink-0"
                    >
                      {/* Rank & Character */}
                      <div className="relative shrink-0 flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-lg z-10",
                          rank === 1 ? "bg-yellow-400 text-indigo-900 border-2 border-yellow-200" :
                            rank === 2 ? "bg-slate-300 text-slate-700" :
                              rank === 3 ? "bg-orange-400 text-white" : "bg-white/10 text-white"
                        )}>
                          {rank}
                        </div>
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 p-0.5 border border-white/10 shadow-inner">
                          <img 
                            src={`/avatars/avatar_${player.avatar_id || 1}.png`} 
                            className="w-full h-full object-cover" 
                            alt="char"
                            width={40}
                            height={40}
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              (e.target as HTMLImageElement).src = '/logo.png';
                            }}
                          />
                        </div>
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
                            ans.event.split(',').slice(0, 3).map((e: string, eIdx: number) => {
                              const evt = getEventInfo(e);
                              if (!evt || e === 'shield') return null; // 방패 아이템은 교사 화면에서 전략적으로 숨김
                              
                              return (
                                <div key={eIdx} className={cn(
                                  "flex flex-col items-center bg-white/10 px-1.5 py-0.5 rounded-lg border border-white/5 relative group/item",
                                  String(currentSwapperId) === String(player.id) && e === 'swap' && "bg-indigo-600 border-indigo-400 scale-110 shadow-lg ring-2 ring-white/20"
                                )}>
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 bg-indigo-900/95 backdrop-blur-xl text-white rounded-[2rem] opacity-0 group-hover/item:opacity-100 transition-all duration-300 whitespace-normal z-[3100] pointer-events-none border-4 border-white/20 shadow-2xl min-w-[200px] scale-90 group-hover/item:scale-100 origin-bottom">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner border border-white/10">{evt.icon}</div>
                                      <div className="font-black text-indigo-200 text-lg">{evt.text}</div>
                                    </div>
                                    <div className="text-xs text-white/80 font-bold leading-relaxed break-keep">
                                      {evt.desc || "획득한 행운의 효과입니다!"}
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-900/95 rotate-45 border-r border-b border-white/20" />
                                  </div>

                                  {String(currentSwapperId) === String(player.id) && e === 'swap' ? (
                                    <>
                                      <RefreshCw className="text-white animate-spin" size={12} />
                                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-black shadow-lg border border-indigo-300">교체 중</span>
                                    </>
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
      <div className="flex-1 bg-white p-10 relative z-10 flex flex-col justify-center overflow-y-auto">
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

        <div className="max-w-6xl mx-auto text-center py-12">
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
                "font-black text-gray-800 break-keep leading-tight text-center w-full [&_p]:m-0 transition-all duration-300 whitespace-pre-wrap",
                (currentQuestion?.q?.length || 0) > 150 ? "text-xl md:text-2xl" :
                  (currentQuestion?.q?.length || 0) > 80 ? "text-2xl md:text-3xl" :
                    "text-3xl md:text-5xl"
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ node, ...props }) => <span className="whitespace-pre-wrap block" {...props} />,
                  }}
                >
                  {processMathText(currentQuestion?.q || "")}
                </ReactMarkdown>
              </div>

              {/* Question Options for Teacher (Simplified & Hidden Answer) */}
              {(currentQuestion?.type === "MULTIPLE_CHOICE" || currentQuestion?.type === "OX") && (
                <div className="grid grid-cols-2 gap-4 w-full max-w-3xl mt-2">
                  {(currentQuestion.options || []).map((opt: string, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        "p-4 md:p-6 rounded-3xl border-4 bg-white border-slate-100 text-slate-600 font-black text-left flex items-center gap-4 transition-all shadow-md opacity-80",
                        getHostOptionFontSize(opt)
                      )}
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 text-sm md:text-lg">
                        {i + 1}
                      </div>
                      <div className="break-all [&_p]:m-0 flex-1">
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
            {(currentQuestion?.type === "SHORT_ANSWER" || currentQuestion?.type === "BLANK") && (
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
                    힌트 보여주기
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

      {/* Main Footer Controls (Now part of flex flow) */}
      <div className="bg-white/95 backdrop-blur-md border-t-2 border-indigo-100 p-4 md:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] flex justify-between items-center z-[101]">
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

      {/* Player Status Bar - Sorted by Score */}
      <PlayerBar
        players={[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0))}
        submissions={answers.filter((a: any) => a.answer !== '(시간초과)').map((a: any) => a.player_id)}
        className="bg-indigo-50/90 border-t border-indigo-200"
        hideBuffs={true}
      />

      {/* Swap Status Overlay/Notification */}
      {swapNotification && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[250] animate-in slide-in-from-bottom-5">
          <div className={cn(
            "px-6 py-3 rounded-2xl font-black shadow-2xl flex items-center gap-3 border-2",
            swapNotification.type === 'success' ? "bg-emerald-500 text-white border-emerald-400" :
            swapNotification.type === 'error' ? "bg-red-500 text-white border-red-400" : "bg-indigo-600 text-white border-indigo-400"
          )}>
            {swapNotification.type === 'success' ? <Check size={20} /> : <X size={20} />}
            {swapNotification.message}
          </div>
        </div>
      )}

      {/* Floating Emojis Container */}
      <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
        {floatingEmojis.map((emoji: any) => (
          <div
            key={emoji.id}
            className="absolute bottom-0 text-5xl animate-float-up opacity-0"
            style={{ left: `${emoji.left}%` }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}
