/** @jsxImportSource react */
"use client";

import { useGame } from "@/hooks/useGame";
import { Button } from "@/components/ui/Button";
import { Users, Play, LogOut, QrCode, Copy, Check, UserCog, UserMinus, RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { HostControl } from "@/components/host/HostControl";
import { Leaderboard } from "@/components/host/Leaderboard";
import { QRCodeModal } from "@/components/host/QRCodeModal";
import { KickConfirmModal, ChangeTeamModal } from "@/components/host/LobbyModals";
import { useDialog } from "@/components/ui/DialogProvider";

export default function HostPage() {
  const { code } = useParams();
  const router = useRouter();
  const { game, players, setPlayers, loading, refresh, refreshPlayers } = useGame(code as string);
  const { showAlert, showConfirm } = useDialog();
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };
  
  // Modal states
  const [showQR, setShowQR] = useState(false);
  const [kickTarget, setKickTarget] = useState<any | null>(null);
  const [teamTarget, setTeamTarget] = useState<any | null>(null);

  const handleStartGame = async () => {
    if (!game || players.length === 0) return showAlert({ title: "알림", message: "최소 한 명의 플레이어가 필요합니다." });
    
    setStarting(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({ 
          status: "PLAYING", 
          current_q_index: 0 
        })
        .eq("id", game.id);

      if (error) throw error;
      
      await refresh();
    } catch (err) {
      showAlert({ title: "오류", message: "게임 시작 실패: " + (err as Error).message });
    } finally {
      setStarting(false);
    }
  };

  const executeKick = async () => {
    if (!kickTarget || !game) return;
    const targetId = kickTarget.id;
    const targetNickname = kickTarget.nickname;
    
    try {
      // 1. Optimistic Update: Remove player from UI immediately
      setPlayers(prev => prev.filter(p => p.id !== targetId));

      // 2. Delete from DB (answers will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", targetId);
      
      if (error) throw error;

      // 3. Broadcast kick event so the student knows immediately
      const channel = supabase.channel(`game_events_${game.id}`);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'KICK_PLAYER',
            payload: { nickname: targetNickname }
          });
          // Cleanup after broadcast
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });

      setKickTarget(null);
    } catch (err) {
      console.error("강퇴 에러:", err);
      showAlert({ message: "강퇴 실패: " + (err as Error).message });
      // On error, refresh to restore the potentially wrongly removed player
      await refresh();
    }
  };

  const executeChangeTeam = async (team: 'RED' | 'BLUE' | 'GREEN' | 'YELLOW') => {
    if (!teamTarget) return;
    try {
      const { error } = await supabase
        .from("players")
        .update({ team })
        .eq("id", teamTarget.id);
      
      if (error) throw error;
      setTeamTarget(null);
    } catch (err) {
      showAlert({ message: "팀 변경 실패: " + (err as Error).message });
    }
  };

  const handleExit = async () => {
    const confirmed = await showConfirm({
      message: "정말로 게임을 종료하고 나가시겠습니까? \n\n'확인'을 누르면 게임이 완전히 종료되고 모든 학생들도 퇴장 처리됩니다."
    });
    
    // confirm returns true for 'Confirm' button, false for 'Cancel' button.
    if (confirmed) {
      try {
        await supabase
          .from("games")
          .update({ status: "ENDED" })
          .eq("id", game?.id);
      } catch (err) {
        console.error("Game termination failed:", err);
      }
      router.push("/dashboard");
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Unified Event Listener
  useEffect(() => {
    if (!game?.id) return;
    const channel = supabase.channel(`game_events_${game.id}`)
      .on('broadcast', { event: 'EMOJI_REACTION' }, ({ payload }: { payload: any }) => {
        const newEmoji = { 
          id: Date.now() + Math.random(), 
          emoji: payload.emoji, 
          left: Math.random() * 80 + 10 
        };
        setFloatingEmojis((prev: any[]) => [...prev, newEmoji]);
        setTimeout(() => setFloatingEmojis((prev: any[]) => prev.filter((e: any) => e.id !== newEmoji.id)), 3000);
      })
      .on('broadcast', { event: 'PLAYER_UPDATE' }, () => {
        // Instant refresh players on avatar/team change
        refreshPlayers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [game?.id, refreshPlayers]);

  // Redirect to results page when game is over
  useEffect(() => {
    if (game?.status === 'ENDED') {
      router.push(`/host/${code}/results`);
    }
  }, [game?.status, code, router]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 gap-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="font-jua text-indigo-800">게임 정보를 불러오는 중...</p>
    </div>
  );
  
  if (!game) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-4">게임을 찾을 수 없습니다.</h2>
      <Button onClick={() => router.push("/dashboard")}>대시보드로 돌아가기</Button>
    </div>
  );

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${code}` : '';

  if (game.status === 'ENDED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-900 text-white">
        <RefreshCw className="animate-spin mb-4" size={48} />
        <h2 className="text-4xl font-jua">최종 순위 집계 중...</h2>
      </div>
    );
  }

  if (game.status === 'PLAYING' || game.status === 'RESULT') {
    return <HostControl game={game} players={players} refreshPlayers={refreshPlayers} />;
  }

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col">
      {showQR && <QRCodeModal url={joinUrl} onClose={() => setShowQR(false)} />}
      {kickTarget && (
        <KickConfirmModal 
          playerName={kickTarget.nickname} 
          onConfirm={executeKick} 
          onCancel={() => setKickTarget(null)} 
        />
      )}
      {teamTarget && (
        <ChangeTeamModal 
          player={teamTarget} 
          teamCount={game.options?.teamCount || 4} 
          onConfirm={executeChangeTeam} 
          onCancel={() => setTeamTarget(null)} 
        />
      )}

      <header className="bg-indigo-600 text-white p-6 shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white text-indigo-600 p-2 rounded-xl font-black text-2xl px-4 flex items-center gap-2">
            <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">CODE</span> {code}
          </div>
          <h1 className="text-2xl font-jua">선생님 대기실</h1>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="secondary" 
            className="text-gray-700 bg-white hover:bg-gray-50 border border-gray-200" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={20} className={cn("mr-2", refreshing && "animate-spin")} />
            새로고침
          </Button>
          <Button variant="ghost" className="text-white hover:bg-indigo-500" onClick={handleCopyLink}>
            {copied ? <Check size={20} className="mr-2 text-green-400" /> : <Copy size={20} className="mr-2" />}
            링크 복사
          </Button>
          <Button variant="danger" onClick={handleExit}>
            <LogOut size={20} className="mr-2" /> 종료
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-hidden flex flex-col max-w-7xl w-full mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div className="animate-pop">
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-600 px-4 py-1 rounded-full text-sm font-black mb-4 uppercase tracking-widest border border-indigo-200">
              <Users size={16} /> Waiting for Students
            </div>
            <h2 className="text-6xl font-jua text-gray-800 mb-2">
              입장 완료: <span className="text-indigo-600 font-black">{players.length}명</span>
            </h2>
            <p className="text-gray-400 font-bold text-xl">화면의 코드를 학생들에게 알려주세요!</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <Button 
              size="xl" 
              className="px-16 py-8 bg-green-500 hover:bg-green-600 shadow-2xl shadow-green-200 rounded-3xl text-3xl font-black transition-all hover:scale-105 active:scale-95"
              onClick={() => handleStartGame()}
              disabled={starting || players.length === 0}
            >
              <Play size={36} className="mr-4 fill-white text-white" /> 게임 시작!
            </Button>
            <button 
              onClick={() => setShowQR(true)}
              className="text-indigo-400 font-bold flex items-center gap-2 hover:text-indigo-600 transition-colors"
            >
               <QrCode size={20} /> QR코드로 접속하기
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white/50 rounded-[3rem] border-4 border-dashed border-indigo-200 p-10 overflow-y-auto scrollbar-hide relative shadow-inner">
          {players.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-pulse">
              <div className="bg-white p-8 rounded-full mb-6 shadow-xl">
                 <Users size={120} className="opacity-20" />
              </div>
              <p className="text-3xl font-jua">학생들이 입장하기를 기다리고 있습니다...</p>
              <p className="mt-2 text-gray-400 font-bold">참여 코드는 {code} 입니다.</p>
            </div>
          ) : !game.options?.isTeamMode ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-8 animate-pop">
              {players.map((player) => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  isTeamMode={false}
                  onKick={() => setKickTarget(player)}
                  onChangeTeam={() => setTeamTarget(player)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-12 animate-pop">
              {Array.from({ length: game.options?.teamCount || 4 }).map((_, i) => {
                const teams: ('RED' | 'BLUE' | 'GREEN' | 'YELLOW')[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
                const team = teams[i];
                const teamPlayers = players.filter(p => p.team === team);
                const teamColors = {
                  RED: 'border-red-200 bg-red-50 text-red-600',
                  BLUE: 'border-blue-200 bg-blue-50 text-blue-600',
                  GREEN: 'border-green-200 bg-green-50 text-green-600',
                  YELLOW: 'border-yellow-200 bg-yellow-50 text-yellow-600'
                };
                const teamNames = { RED: '빨강팀', BLUE: '파랑팀', GREEN: '초록팀', YELLOW: '노랑팀' };

                return (
                  <div key={team} className="space-y-4">
                    <div className={cn("inline-flex items-center gap-2 px-6 py-2 rounded-2xl border-2 font-black text-lg", teamColors[team])}>
                      {teamNames[team]} ({teamPlayers.length}명)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                      {teamPlayers.map((player) => (
                        <PlayerCard 
                          key={player.id} 
                          player={player} 
                          isTeamMode={true}
                          onKick={() => setKickTarget(player)}
                          onChangeTeam={() => setTeamTarget(player)}
                        />
                      ))}
                      {teamPlayers.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-300 font-bold border-2 border-dashed border-gray-100 rounded-3xl">
                          입장 대기 중...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {players.filter(p => !p.team).length > 0 && (
                <div className="space-y-4 pt-8 border-t-4 border-dashed border-gray-100">
                  <div className="inline-flex items-center gap-2 px-6 py-2 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-500 font-black text-lg">
                    팀 미배정 ({players.filter(p => !p.team).length}명)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                    {players.filter(p => !p.team).map((player) => (
                      <PlayerCard 
                        key={player.id} 
                        player={player} 
                        isTeamMode={true}
                        onKick={() => setKickTarget(player)}
                        onChangeTeam={() => setTeamTarget(player)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
      </main>

      {/* Global Floating Emojis Layer */}
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {floatingEmojis.map((e: any) => (
          <div
            key={e.id}
            className="float-up-reaction"
            style={{ left: `${e.left}%` }}
          >
            {e.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ 
  player, 
  isTeamMode,
  onKick, 
  onChangeTeam 
}: { 
  player: any, 
  isTeamMode?: boolean,
  onKick: () => void, 
  onChangeTeam: () => void 
}) {
  return (
    <div className="group bg-white p-5 rounded-[2rem] shadow-sm border-2 border-indigo-50 flex flex-col items-center text-center relative hover:shadow-2xl hover:shadow-indigo-100 transition-all hover:border-indigo-400 active:scale-95 duration-300">
      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
        {isTeamMode && (
          <button 
            onClick={onChangeTeam}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            title="팀 변경"
          >
            <UserCog size={16} />
          </button>
        )}
        <button 
          onClick={onKick}
          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
          title="강퇴"
        >
          <UserMinus size={16} />
        </button>
      </div>

      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl mb-3 transition-all duration-500 overflow-hidden",
        !player.team ? "bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white" :
        player.team === 'RED' ? 'bg-red-500 text-white' :
        player.team === 'BLUE' ? 'bg-blue-500 text-white' :
        player.team === 'GREEN' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-white'
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
      <div className="font-black text-slate-800 truncate w-full text-base">{player.nickname}</div>
    </div>
  );
}
