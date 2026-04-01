"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { 
  Plus, 
  Play, 
  Edit3, 
  Trash2, 
  ChevronLeft, 
  LayoutDashboard, 
  Search,
  BookOpen,
  Settings,
  MoreVertical,
  LogOut,
  Zap,
  Shield,
  Users,
  Scissors,
  Gift,
  RefreshCw,
  X,
  Sparkles
} from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Footer } from "@/components/layout/Footer";
import { generateQuizCode, cn } from "@/lib/utils";
import { defaultQuestions } from "@/lib/questions";
import { useDialog } from "@/components/ui/DialogProvider";
import { Spinner } from "@/components/ui/Spinner";
import { EventSettingsModal } from "@/components/host/LobbyModals";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalStudents: 0, avgParticipation: 0, totalQuestions: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const { showAlert, showConfirm, showPrompt } = useDialog();
  const [gameOptions, setGameOptions] = useState({
    isTeamMode: false,
    teamCount: 4,
    double: true,
    swap: true,
    strike: true,
    cut: true,
    donate: true,
    shield: true
  });
  const [showProbSettings, setShowProbSettings] = useState(false);
  const [probabilities, setProbabilities] = useState({
    double: 5,
    swap: 5,
    strike: 5,
    shield: 5,
    cut: 5,
    donate: 5
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
    // Load probabilities from localStorage
    const saved = localStorage.getItem("quiz_probs");
    if (saved) {
      try {
        setProbabilities(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved probabilities");
      }
    }
  }, [user, authLoading, router]);

  const handleSaveProbabilities = (newProbs: any) => {
    setProbabilities(newProbs);
    localStorage.setItem("quiz_probs", JSON.stringify(newProbs));
    setShowProbSettings(false);
  };

  useEffect(() => {
    if (user) {
      fetchQuizzes();
    }
  }, [user]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);

      let totalQuestions = 0;
      data?.forEach((q: any) => { totalQuestions += (q.questions?.length || 0); });

      const quizIds = (data || []).map((q: any) => q.id);
      if (quizIds.length > 0) {
        const { data: games } = await supabase.from("games").select("id").in("quiz_id", quizIds);
        const gameIds = games?.map(g => g.id) || [];
        
        let totalStudents = 0;
        let avgParticipation = 0;

        if (gameIds.length > 0) {
          const { count: students } = await supabase.from("players").select("*", { count: "exact", head: true }).in("game_id", gameIds);
          const { count: answers } = await supabase.from("answers").select("*", { count: "exact", head: true }).in("game_id", gameIds);
          totalStudents = students || 0;
          const totalExpectedAnswers = totalStudents * (totalQuestions || 1);
          avgParticipation = totalExpectedAnswers > 0 ? Math.min(100, Math.round(((answers || 0) / totalExpectedAnswers) * 100)) : 0;
        }
        setStats({ totalStudents, avgParticipation, totalQuestions });
      } else {
        setStats({ totalStudents: 0, avgParticipation: 0, totalQuestions });
      }

    } catch (err) {
      console.error("퀴즈 목록 가져오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    const title = await showPrompt({ 
      message: "새로운 퀴즈 제목을 입력하세요:", 
      defaultValue: "제목 없는 퀴즈" 
    });
    if (!title) return;

    try {
      const { data, error } = await supabase
        .from("quizzes")
        .insert([{ 
          user_id: user?.id, 
          title, 
          questions: [] // Empty questions instead of default
        }])
        .select()
        .single();

      if (error) throw error;
      router.push(`/dashboard/edit/${data.id}`);
    } catch (err) {
      await showAlert({ message: "퀴즈 생성 실패: " + (err as Error).message });
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    const confirmed = await showConfirm({ message: "정말 이 퀴즈를 삭제하시겠습니까?" });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch (err) {
      await showAlert({ message: "삭제 실패: " + (err as Error).message });
    }
  };

  const handleStartGame = async () => {
    if (!selectedQuiz) return;
    const code = generateQuizCode();
    try {
      const { data, error } = await supabase
        .from("games")
        .insert([{ 
          code, 
          status: "WAITING", 
          quiz_id: selectedQuiz.id,
          host_id: user?.id,
          options: { 
            ...gameOptions,
            probabilities,
            questions: selectedQuiz.questions,
            level: selectedQuiz.school_level === '초등' ? 'elementary' : selectedQuiz.school_level === '중' ? 'middle' : selectedQuiz.school_level === '고등' ? 'high' : 'elementary'
          } 
        }])
        .select()
        .single();

      if (error) throw error;
      router.push(`/host/${code}`);
    } catch (err) {
      await showAlert({ message: "게임 생성 실패: " + (err as Error).message });
    }
  };

  if (authLoading || (loading && quizzes.length === 0)) {
    return <Spinner fullScreen label="선생님 대시보드 준비 중..." />;
  }

  const filteredQuizzes = quizzes.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <TopNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 relative">
        <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-indigo-100/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-violet-100/30 rounded-full blur-[100px]" />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
           <StatsCard label="전체 퀴즈" value={quizzes.length.toString()} icon={<BookOpen />} color="indigo" />
           <StatsCard label="참여 학생" value={`${stats.totalStudents}명`} icon={<Users />} color="emerald" />
           <StatsCard label="평균 참여율" value={`${stats.avgParticipation}%`} icon={<Zap />} color="amber" />
           <StatsCard label="전체 문항 수" value={`${stats.totalQuestions}개`} icon={<Sparkles />} color="violet" />
        </div>

        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 mb-2 tracking-tight">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                <LayoutDashboard className="text-indigo-600" size={28} />
              </div>
              내 퀴즈 보관함
            </h1>
            <p className="text-slate-400 font-bold ml-15">선생님의 소중한 학습 자료들이 안전하게 보관 중입니다.</p>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="secondary"
              size="xl" 
              className="rounded-[1.5rem] px-8 py-8 border-2 border-slate-100 bg-white text-slate-600 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 group shadow-sm"
              onClick={() => setShowProbSettings(true)}
            >
              <Settings size={28} className="mr-2 group-hover:rotate-90 transition-transform duration-500" /> 효과 확률 설정
            </Button>
            <Button 
              size="xl" 
              className="rounded-[1.5rem] px-10 py-8 shadow-2xl shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 group"
              onClick={handleCreateQuiz}
            >
              <Plus size={28} className="mr-2 group-hover:rotate-90 transition-transform duration-300" /> 새 퀴즈 만들기
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-[2rem] shadow-sm border border-white/50 mb-12 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="찾으시는 퀴즈의 제목을 입력하세요..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100/50 border-2 border-transparent focus:border-indigo-400 focus:bg-white p-5 pl-14 rounded-2xl outline-none transition-all font-bold placeholder:text-slate-300"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="rounded-2xl w-14 h-14 p-0 text-slate-400 border border-slate-100 bg-white"><Settings size={22}/></Button>
            </div>
        </div>

        {/* Quizzes Grid */}
        {loading && quizzes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white h-72 rounded-[2.5rem] border border-slate-100 shadow-sm" />
            ))}
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-sm h-96 rounded-[3rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-inner">
               <BookOpen size={48} className="opacity-20" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-400 mb-2">등록된 퀴즈가 없습니다.</p>
              <Button variant="ghost" className="text-indigo-600 font-black text-lg hover:bg-indigo-50 px-8 py-4 rounded-2xl transition-all" onClick={handleCreateQuiz}>지금 첫 퀴즈를 만들어보세요!</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredQuizzes.map((quiz) => (
              <div 
                key={quiz.id} 
                className="group bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-[0_32px_64px_-16px_rgba(79,70,229,0.15)] transition-all hover:-translate-y-3 relative active:scale-95 duration-500"
              >
                <div className="h-3 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-slate-50 text-slate-400 p-4 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-500">
                      <BookOpen size={28} />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDeleteQuiz(quiz.id); }} 
                         className="w-10 h-10 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-sm" 
                         title="삭제"
                       >
                         <Trash2 size={18} />
                       </button>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-gray-800 mb-2 truncate group-hover:text-indigo-600 transition-colors">
                    {quiz.title}
                  </h3>
                  <p className="text-gray-400 font-bold text-sm mb-6">
                    {quiz.questions?.length || 0}개의 문제 세트
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="primary" 
                      className="w-full rounded-xl py-3 !bg-indigo-600 hover:!bg-indigo-700"
                      onClick={() => setSelectedQuiz(quiz)}
                    >
                      <Play size={18} className="mr-2" /> 시작
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full rounded-xl py-3 border border-gray-100 text-gray-600 font-bold hover:bg-gray-50"
                      onClick={() => router.push(`/dashboard/edit/${quiz.id}`)}
                    >
                      <Edit3 size={18} className="mr-2" /> 수정
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Game Settings Modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-8 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-jua text-indigo-900 mb-1">게임 설정 확인</h2>
                <p className="text-indigo-600 font-bold">"{selectedQuiz.title}" 퀴즈를 시작합니다.</p>
              </div>
              <button 
                onClick={() => setSelectedQuiz(null)}
                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={28} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Mode Toggle */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                      <Users size={20} />
                    </div>
                    <span className="font-black text-gray-800 text-lg">팀전 모드 사용</span>
                  </div>
                  <button 
                    onClick={() => setGameOptions(prev => ({ ...prev, isTeamMode: !prev.isTeamMode }))}
                    className={cn(
                      "w-16 h-8 rounded-full transition-all relative p-1",
                      gameOptions.isTeamMode ? "bg-purple-500 shadow-inner shadow-purple-900/20" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 bg-white rounded-full shadow-md transition-transform",
                      gameOptions.isTeamMode ? "translate-x-8" : "translate-x-0"
                    )} />
                  </button>
                </div>
                
                {gameOptions.isTeamMode && (
                  <div className="flex gap-2 p-2 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    {[2, 3, 4].map(num => (
                      <button 
                        key={num}
                        onClick={() => setGameOptions(prev => ({ ...prev, teamCount: num }))}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold transition-all",
                          gameOptions.teamCount === num 
                            ? "bg-white text-purple-600 shadow-sm border border-purple-100" 
                            : "text-gray-400 hover:bg-white/50"
                        )}
                      >
                        {num}팀
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Event Toggles */}
              <div className="space-y-4">
                <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                  <Sparkles size={20} className="text-yellow-500" /> 이벤트 효과 사용 설정
                  <span className="text-slate-400 text-[10px] font-bold ml-1">대시보드에서 발동 확률을 지정할 수 있습니다.</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'double', label: '점수 2배', icon: <span className="text-[10px] font-black leading-none">X2</span>, color: 'yellow' },
                    { id: 'strike', label: '스트라이크', icon: <Zap size={16} />, color: 'blue' },
                    { id: 'shield', label: '방어권', icon: <Shield size={16} />, color: 'cyan' },
                    { id: 'swap', label: '점수 교체', icon: <RefreshCw size={16} />, color: 'indigo' },
                    { id: 'cut', label: '점수 깎기', icon: <Scissors size={16} />, color: 'red' },
                    { id: 'donate', label: '점수 기부', icon: <Gift size={16} />, color: 'green' },
                  ].map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => setGameOptions(prev => ({ ...prev, [opt.id]: !(prev as any)[opt.id] }))}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all font-bold",
                        (gameOptions as any)[opt.id]
                          ? `border-${opt.color}-400 bg-${opt.color}-50 text-${opt.color}-900`
                          : "border-gray-100 bg-white text-gray-400 opacity-60 grayscale"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        (gameOptions as any)[opt.id] ? `bg-${opt.color}-200` : "bg-gray-100"
                      )}>
                        {opt.icon}
                      </div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  variant="ghost" 
                  size="xl"
                  className="flex-1 rounded-2xl py-6 font-bold text-gray-500 hover:bg-gray-50"
                  onClick={() => setSelectedQuiz(null)}
                >
                  취소
                </Button>
                <Button 
                  variant="primary" 
                  size="xl"
                  className="flex-[2] rounded-2xl py-6 shadow-indigo-100 shadow-lg text-xl"
                  onClick={handleStartGame}
                >
                  <Play size={24} className="mr-2" /> 게임 시작!
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showProbSettings && (
        <EventSettingsModal 
          probabilities={probabilities}
          onSave={handleSaveProbabilities}
          onCancel={() => setShowProbSettings(false)}
        />
      )}
      <Footer />
    </div>
  );
}

function StatsCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", colorMap[color] || colorMap.indigo)}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 } as any)}
      </div>
      <div>
        <div className="text-slate-400 text-xs font-black uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-2xl font-black text-slate-900">{value}</div>
      </div>
    </div>
  );
}
