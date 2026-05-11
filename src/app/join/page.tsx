"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Monitor, UserPlus, GraduationCap, LayoutDashboard, LogOut } from "lucide-react";
import { generateQuizCode } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { defaultQuestions } from "@/lib/questions";
import { useDialog } from "@/components/ui/DialogProvider";

export default function JoinPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [nickname, setNickname] = useState("");
  const [quizCode, setQuizCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { showAlert } = useDialog();

  useEffect(() => {
    // Check for code in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const name = params.get("name");
    
    if (code) setQuizCode(code);
    else {
      const savedCode = localStorage.getItem("last_quiz_code");
      if (savedCode) setQuizCode(savedCode);
    }

    if (name) setNickname(name);
    else {
      const savedName = localStorage.getItem("last_nickname");
      if (savedName) setNickname(savedName);
    }
  }, []);

  const handleJoinGame = async () => {
    if (!nickname || !quizCode) return showAlert({ message: "이름과 퀴즈 코드를 입력해주세요." });
    const cleanNickname = nickname.trim();
    const cleanCode = quizCode.toUpperCase().trim();

    setLoading(true);
    try {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, options")
        .eq("code", cleanCode)
        .single();

      if (gameError || !game) throw new Error("유효하지 않은 퀴즈 코드입니다.");

      // Store in localStorage
      localStorage.setItem("last_nickname", cleanNickname);
      localStorage.setItem("last_quiz_code", cleanCode);

      // Check for existing player (re-entry) and game status
      const { data: gameDetails } = await supabase
        .from("games")
        .select("status")
        .eq("id", game.id)
        .single();

      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id, score")
        .eq("game_id", game.id)
        .eq("nickname", cleanNickname)
        .maybeSingle();

      let shouldInsert = !existingPlayer;
      
      if (existingPlayer) {
        // --- DUPLICATE NICKNAME GUARD (WAITING ROOM ONLY) ---
        // We use a session-based check to allow 'me' to re-join but block 'others'.
        const savedPlayerId = localStorage.getItem(`player_session_${game.id}`);
        const isMe = savedPlayerId === existingPlayer.id;

        if (!isMe && gameDetails?.status === 'WAITING') {
          throw new Error("이미 사용 중인 닉네임입니다. 다른 이름을 사용해주세요.");
        }
        
        console.log("Re-joining existing game session:", cleanNickname, "session verified:", isMe);
        shouldInsert = false;
        
        // Ensure my session is saved (in case it was partially lost or manual entry)
        localStorage.setItem(`player_session_${game.id}`, existingPlayer.id);
      }

      if (shouldInsert) {
        const isTeamMode = game.options?.isTeamMode || false;
        const teamCount = game.options?.teamCount || 4;
        let assignedTeam: 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | null = null;

        if (isTeamMode) {
          const { data: currentPlayers } = await supabase
            .from("players")
            .select("team")
            .eq("game_id", game.id);
          
          const counts: Record<string, number> = { RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0 };
          currentPlayers?.forEach(p => { if (p.team) counts[p.team]++; });
          
          const teams: ('RED' | 'BLUE' | 'GREEN' | 'YELLOW')[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
          const activeTeams = teams.slice(0, teamCount);
          assignedTeam = activeTeams.reduce((a, b) => counts[a] <= counts[b] ? a : b);
        }

        // --- UNIQUE AVATAR ASSIGNMENT ---
        // Fetch all avatar_ids already in use for this game
        const { data: usedAvatars } = await supabase
          .from("players")
          .select("avatar_id")
          .eq("game_id", game.id);
        
        const usedIds = new Set(usedAvatars?.map(p => p.avatar_id).filter(id => id !== null));
        let assignedAvatarId = 1;

        // Try to find an unused ID from 1 to 30 (Excluding 26 which is missing)
        const availableIds = Array.from({ length: 30 }, (_, i) => i + 1)
          .filter(id => id !== 26 && !usedIds.has(id));
        
        if (availableIds.length > 0) {
          // Pick a random one from available to avoid sequential predictability
          assignedAvatarId = availableIds[Math.floor(Math.random() * availableIds.length)];
        } else {
          // If all available are used, pick a random one from 1-30 (excluding 26)
          const backupIds = Array.from({ length: 30 }, (_, i) => i + 1).filter(id => id !== 26);
          assignedAvatarId = backupIds[Math.floor(Math.random() * backupIds.length)];
        }

        const { data: newPlayer, error: playerError } = await supabase
          .from("players")
          .insert([{ 
            game_id: game.id, 
            nickname: cleanNickname, 
            score: 0,
            team: assignedTeam,
            avatar_id: assignedAvatarId
          }])
          .select()
          .single();

        if (playerError) throw playerError;
        if (newPlayer) {
          localStorage.setItem(`player_session_${game.id}`, newPlayer.id);
        }
      }
      
      router.push(`/play/${cleanCode}?name=${cleanNickname}`);
    } catch (err) {
      showAlert({ message: "입장 실패: " + (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-bold">로딩 중...</div>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-yellow-50 to-orange-100">
      <div className="w-full max-w-md text-center animate-pop">
        <div className="mb-12">
          <img src="/logo.png" alt="클래스 퀴즈 잼!" className="h-40 mx-auto object-contain animate-bounce mb-4" />
          <p className="text-gray-600 text-lg font-bold">퀴즈 코드를 입력하고 입장하세요</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-orange-200/50 border-t-8 border-yellow-400">
          <h2 className="text-3xl font-jua text-yellow-600 mb-8 flex items-center justify-center gap-2">
            <UserPlus size={32} /> 학생 입장
          </h2>
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="내 이름 입력"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full p-5 text-xl border-4 border-yellow-100 rounded-2xl focus:border-yellow-400 outline-none text-center font-black text-slate-900 placeholder:text-gray-300 transition-all"
              />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="퀴즈 코드 6자리"
                value={quizCode}
                onChange={(e) => setQuizCode(e.target.value)}
                className="w-full p-5 text-xl border-4 border-yellow-100 rounded-2xl focus:border-yellow-400 outline-none text-center font-black text-slate-900 uppercase placeholder:text-gray-300 transition-all"
              />
            </div>
            <Button 
              variant="yellow" 
              size="xl" 
              className="w-full py-6 mt-4 shadow-lg shadow-yellow-200 text-2xl"
              onClick={handleJoinGame}
              disabled={loading}
            >
              입장하기!
            </Button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col gap-3">
             <button 
                onClick={() => router.push("/")}
                className="text-gray-400 font-bold hover:text-indigo-500 transition-colors text-sm"
              >
                선생님 이신가요? 메인으로 돌아가기
              </button>
          </div>
        </div>
      </div>
    </main>
  );
}
