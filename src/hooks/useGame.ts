import { useEffect, useState, useCallback } from 'react';
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
  const gameRef = useRef<Game | null>(null);
  const playersRef = useRef<Player[]>([]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

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
        .channel(`game_events:${gameId}`)
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
        .on('broadcast', { event: 'GAME_UPDATE' }, async () => {
          console.log("[useGame] Broadcast GAME_UPDATE received. Refreshing...");
          // Refresh game data
          const { data: g } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
          if (g) setGame(prev => ({ ...(prev || {}), ...g }));
          // Also refresh players
          fetchPlayersThrottled(gameId);
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
          (payload) => {
            console.log("[useGame] Players change detected:", payload.eventType);
            
            if (payload.eventType === 'UPDATE') {
              setPlayers(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
            } else if (payload.eventType === 'INSERT') {
              setPlayers(prev => {
                const exists = prev.some(p => p.id === payload.new.id);
                if (exists) return prev;
                return [...prev, payload.new as Player];
              });
            } else if (payload.eventType === 'DELETE') {
              setPlayers(prev => prev.filter(p => p.id === payload.old.id));
            }
            
            // Still throttle a full fetch occasionally to ensure order and consistency
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
      }, 5000); // Relaxed polling as we have better incremental updates
    };

    const fetchPlayersThrottled = (gameId: string) => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(async () => {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .order(gameRef.current?.status === 'WAITING' ? 'nickname' : 'score', { ascending: gameRef.current?.status === 'WAITING' })
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          setPlayers(data);
        }
        fetchTimeout = null;
      }, 100); // Reduced from 300ms to 100ms for faster sync
    };

    fetchInitialData();

    return () => {
      if (channelsRef.game) channelsRef.game.unsubscribe();
      if (channelsRef.players) channelsRef.players.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, [quizCode]);

  const refresh = useCallback(async () => {
    if (!quizCode) return;
    try {
      const { data: g } = await supabase.from('games').select('*').eq('code', quizCode).single();
      if (g) {
        setGame(g);
        const { data: p } = await supabase.from('players').select('*').eq('game_id', g.id);
        if (p) setPlayers(p);
      }
    } catch (err) {
      console.error("[useGame] manual refresh failed:", err);
    }
  }, [quizCode]);

  const refreshPlayers = useCallback(async () => {
    if (!game?.id) return;
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setPlayers(data);
      }
    } catch (err) {
      console.error("[useGame] refreshPlayers failed:", err);
    }
  }, [game?.id]);

  return { 
    game, 
    players, 
    setPlayers,
    loading, 
    error, 
    refresh, 
    refreshPlayers
  };
}
