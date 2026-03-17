"use client";

import { useGame } from "@/hooks/useGame";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Trophy, Home, Medal, Star, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, Suspense } from "react";

function ResultsContent() {
  const { code } = useParams();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const router = useRouter();
  
  const { game, players, loading } = useGame(code as string);

  // Derived state (Placed above hooks to ensure they are always calculated if possible, 
  // but they don't count as hooks themselves)
  const me = players.find(p => p.nickname === name);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myRank = name ? sortedPlayers.findIndex(p => p.nickname === name) + 1 : 0;

  useEffect(() => {
    if (!loading && players.length > 0 && myRank > 0 && myRank <= 3) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#4f46e5", "#10b981", "#fbbf24"]
      });
    }
  }, [loading, players.length, myRank]);

  // --- RENDERING ---
  
  let content = null;

  if (loading) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy size={48} className="text-indigo-200" />
          <div className="text-2xl text-indigo-400">결과 집계 중...</div>
        </div>
      </div>
    );
  } else if (!me) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 font-jua p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border-b-4 border-indigo-100 max-w-sm">
          <Medal size={48} className="text-indigo-200 mb-4 mx-auto" />
          <h2 className="text-xl mb-2 text-gray-700">참여 정보를 확인하고 있어요</h2>
          <p className="text-gray-400 text-sm">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full animate-pop">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-indigo-200">
            <div className="bg-indigo-600 p-12 flex flex-col items-center text-white relative">
              <div className="absolute top-4 right-4 opacity-20">
                 <Zap size={80} />
              </div>
              <Trophy size={80} className="mb-4 text-yellow-400 drop-shadow-lg" />
              <h1 className="text-3xl font-jua mb-2">게임 종료!</h1>
              <p className="opacity-80 font-bold">{name} 학생, 수고하셨습니다!</p>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex flex-col items-center">
                <div className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">현재 내 점수</div>
                <div className="text-7xl font-black text-indigo-600 drop-shadow-sm">{me.score}점</div>
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 text-left">
                  <div className="bg-yellow-100 text-yellow-600 p-3 rounded-xl">
                    <Medal size={32} />
                  </div>
                  <div>
                     <div className="text-xs font-black text-gray-400 uppercase">최종 순위</div>
                     <div className="text-2xl font-black text-gray-800">{myRank === 0 ? '-' : myRank}위 / {players.length}명</div>
                  </div>
                </div>
                {myRank === 1 && (
                  <div className="bg-indigo-600 text-white px-4 py-1 rounded-full font-black text-xs animate-pulse">
                    CHAMPION
                  </div>
                )}
              </div>

              <p className="text-gray-500 font-bold leading-relaxed">
                정말 잘했어요! <br/>
                선생님과 친구들과 함께한 퀴즈 게임이 즐거웠나요?
              </p>

              <Button 
                variant="primary" 
                size="xl" 
                className="w-full py-6 rounded-2xl text-xl font-black shadow-xl"
                onClick={() => router.push("/join")}
              >
                다시 참여하기
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 text-indigo-300 font-bold text-sm">
          © 2026 Class Quiz Jam • 실시간 퀴즈 앱
        </div>
      </div>
    );
  }

  return content;
}

export default function StudentResults() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold font-jua text-indigo-600 text-2xl">페이지를 준비 중입니다...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
