import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Game {
  id: string;
  code: string;
  quiz_id: string | null;
  host_id: string;
  status: 'WAITING' | 'PLAYING' | 'RESULT' | 'ENDED';
  current_q_index: number;
  current_hint_stage: number;
  options: any;
}

export interface Player {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  team: 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | null;
  buffs: string[];
  is_alive: boolean;
  avatar_id?: number;
}

export function useGame(quizCode: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizCode) return;

    async function fetchInitialData() {
      try {
        setLoading(true);
        // 1. Fetch Game
        const { data: gData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('code', quizCode)
          .single();

        if (gameError) throw gameError;
        setGame(gData);

        // 2. Fetch Players
        const { data: pData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gData.id)
          .order(gData.status === 'WAITING' ? 'nickname' : 'score', { ascending: gData.status === 'WAITING' })
          .order('created_at', { ascending: true });

        if (playersError) throw playersError;
        setPlayers(pData || []);

        // --- Setup Subscriptions only after initial data is loaded ---
        setupSubscriptions(gData.id);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    let gameChannel: any = null;
    let playersChannel: any = null;
    let pollInterval: any = null;
    let fetchTimeout: any = null;

    const channelsRef = {
      game: null as any,
      players: null as any
    };

    const setupSubscriptions = (gameId: string) => {
      // Cleanup any existing channels first
      if (channelsRef.game) supabase.removeChannel(channelsRef.game);
      if (channelsRef.players) supabase.removeChannel(channelsRef.players);

      // 1. Game Status Subscription
      channelsRef.game = supabase
        .channel(`game_realtime:${gameId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          (payload) => {
            console.log("[useGame] Game update received:", payload.eventType);
            setGame(prev => {
              if (!prev) return payload.new as Game;
              // Deep merge options to avoid losing data
              const updated = { ...prev, ...payload.new };
              if (!updated.options && prev.options) updated.options = prev.options;
              return updated;
            });
          }
        )
        .on('broadcast', { event: 'HINT_REVEAL' }, ({ payload }) => {
          console.log("[useGame] Broadcast HINT_REVEAL received:", payload);
          setGame(prev => prev ? { ...prev, current_hint_stage: payload.stage } : null);
        })
        .subscribe((status) => {
          console.log(`[useGame] Game channel status: ${status}`);
        });

      // 2. Players Subscription
      channelsRef.players = supabase
        .channel(`players_realtime:${gameId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
          () => {
            console.log("[useGame] Players change detected, fetching...");
            fetchPlayersThrottled(gameId);
          }
        )
        .subscribe();

      // 3. Polling Fallback (Safety net)
      pollInterval = setInterval(async () => {
        const { data: g } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
        if (g) {
          setGame(prev => {
            if (!prev) return g;
            // Only update if something changed to avoid unnecessary re-renders
            if (prev.status !== g.status || 
                prev.current_q_index !== g.current_q_index || 
                prev.current_hint_stage !== g.current_hint_stage ||
                JSON.stringify(prev.options) !== JSON.stringify(g.options)) {
              return { ...prev, ...g };
            }
            return prev;
          });
        }
        fetchPlayersThrottled(gameId);
      }, 3000); // Slightly more aggressive polling during active play
    };

    const fetchPlayersThrottled = (gameId: string) => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(async () => {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .order(game?.status === 'WAITING' ? 'nickname' : 'score', { ascending: game?.status === 'WAITING' })
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          setPlayers(data);
        }
        fetchTimeout = null;
      }, 300); // 300ms debounce
    };

    fetchInitialData();

    return () => {
      if (channelsRef.game) supabase.removeChannel(channelsRef.game);
      if (channelsRef.players) supabase.removeChannel(channelsRef.players);
      if (pollInterval) clearInterval(pollInterval);
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, [quizCode]);

  const refreshAction = async () => {
    if (!quizCode) return;
    const { data: g } = await supabase.from('games').select('*').eq('code', quizCode).single();
    if (g) {
      setGame(g);
      const { data: p } = await supabase.from('players').select('*').eq('game_id', g.id);
      if (p) setPlayers(p);
    }
  };

  const refreshPlayers = async () => {
    if (!game?.id) return;
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setPlayers(data);
    }
  };

  return { 
    game, 
    players, 
    setPlayers,
    loading, 
    error, 
    refresh: refreshAction, 
    refreshPlayers
  };
}
