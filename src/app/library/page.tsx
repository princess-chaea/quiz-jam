"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { 
  Search, 
  Library, 
  Copy, 
  ChevronLeft,
  GraduationCap,
  BookOpen,
  Filter,
  X,
  Hash
} from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { useDialog } from "@/components/ui/DialogProvider";
import { Spinner } from "@/components/ui/Spinner";
import { Footer } from "@/components/layout/Footer";
import { cn, processMathText } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<any>(null);
  const { showAlert } = useDialog();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, profiles(school_name, name, avatar_url)")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (err) {
      console.error("퀴즈를 불러오는 데 실패했습니다", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuiz = async (quiz: any) => {
    if (!user) {
      await showAlert({ message: "로그인이 필요합니다." });
      router.push("/");
      return;
    }

    setCopyingId(quiz.id);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .insert([{
          user_id: user.id,
          title: `${quiz.title} (복사본)`,
          questions: quiz.questions,
          is_public: false, // Default copied quizzes to private
          school_level: quiz.school_level,
          grade: quiz.grade,
          subjects: quiz.subjects
        }])
        .select()
        .single();

      if (error) throw error;
      
      await showAlert({ message: "내 퀴즈로 복사되었습니다! 대시보드로 이동합니다." });
      router.push("/dashboard");
    } catch (err) {
      await showAlert({ message: "복사 실패: " + (err as Error).message });
    } finally {
      setCopyingId(null);
    }
  };

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLevel = filterLevel === "all" || (quiz.school_level && quiz.school_level.includes(filterLevel));
    const matchGrade = filterGrade === "all" || (quiz.grade && quiz.grade.toString() === filterGrade);
    const matchSubject = filterSubject === "all" || (quiz.subjects && quiz.subjects.includes(filterSubject));
    return matchSearch && matchLevel && matchGrade && matchSubject;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <TopNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 flex flex-col gap-8">
        
        {/* Filters */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-400 focus:bg-white outline-none transition-all font-bold placeholder:font-medium"
              placeholder="퀴즈 검색..."
            />
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-2">
              <GraduationCap className="text-gray-400" size={18} />
              <select 
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-transparent font-bold outline-none text-gray-700 cursor-pointer"
              >
                <option value="all">모든 학교</option>
                <option value="초등">초등학교</option>
                <option value="중">중학교</option>
                <option value="고등">고등학교</option>
              </select>
            </div>

            <div className={`flex items-center gap-2 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-2 transition-all ${['초등', '중', '고등'].includes(filterLevel) ? 'opacity-100' : 'opacity-0 pointer-events-none w-0 !px-0 !border-0 overflow-hidden'}`}>
              <Hash className="text-gray-400" size={18} />
              <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-transparent font-bold outline-none text-gray-700 cursor-pointer"
              >
                <option value="all">모든 학년</option>
                {(filterLevel === '초등' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(g => (
                  <option key={g} value={g.toString()}>{g}학년</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-2">
              <BookOpen className="text-gray-400" size={18} />
              <select 
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="bg-transparent font-bold outline-none text-gray-700 cursor-pointer"
              >
                <option value="all">모든 과목</option>
                <option value="국어">국어</option>
                <option value="수학">수학</option>
                <option value="사회">사회</option>
                <option value="과학">과학</option>
                <option value="영어">영어</option>
                <option value="정보">정보</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quiz Grid */}
        {loading ? (
          <Spinner label="라이브러리 불러오는 중..." />
        ) : filteredQuizzes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Filter size={48} className="text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">검색 결과가 없습니다</h2>
            <p className="text-gray-400">다른 조건으로 검색해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map(quiz => (
              <div key={quiz.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1 transition-all flex flex-col group">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {quiz.school_level && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-black">
                        {quiz.school_level}학교
                      </span>
                    )}
                    {quiz.grade && (
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">
                        {quiz.grade}학년
                      </span>
                    )}
                    {quiz.subjects && quiz.subjects.map((subj: string) => (
                      <span key={subj} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black">
                        {subj}
                      </span>
                    ))}
                    {!quiz.school_level && !quiz.grade && (!quiz.subjects || quiz.subjects.length === 0) && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-black">
                        분류 없음
                      </span>
                    )}
                  </div>
                  <h3 className="font-jua text-2xl mb-2 text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>
                  
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-sm font-bold text-gray-400">
                      {quiz.questions?.length || 0}문제
                    </p>
                    
                    {quiz.profiles && (
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 pr-3 pl-1 py-1 rounded-full border border-gray-100">
                        {quiz.profiles.avatar_url ? (
                          <img src={quiz.profiles.avatar_url} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            {quiz.profiles.name.charAt(0)}
                          </div>
                        )}
                        <span>{quiz.profiles.school_name} {quiz.profiles.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 mt-auto flex flex-col gap-2">
                  <Button 
                    variant="ghost" 
                    className="w-full rounded-xl hover:bg-gray-50 hover:text-gray-900 border-2 border-transparent hover:border-gray-200 group/preview"
                    onClick={() => setPreviewQuiz(quiz)}
                  >
                    <BookOpen size={16} className="mr-2 text-gray-400 group-hover/preview:text-indigo-500" /> 상세보기
                  </Button>
                  <Button 
                    variant="primary" 
                    className="w-full rounded-xl shadow-lg shadow-indigo-100 group/btn"
                    onClick={() => handleCopyQuiz(quiz)}
                    disabled={copyingId === quiz.id}
                  >
                    {copyingId === quiz.id ? '복사 중...' : (
                      <>
                        <Copy size={16} className="mr-2 group-hover/btn:scale-110 transition-transform" /> 내 퀴즈로 가져오기
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Modal */}
        {previewQuiz && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-pop flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-2xl font-jua text-gray-800 line-clamp-1">{previewQuiz.title}</h2>
                  <p className="text-sm font-bold text-indigo-500 mt-1">{previewQuiz.questions?.length || 0}개의 문제가 포함되어 있습니다.</p>
                </div>
                <button 
                  onClick={() => setPreviewQuiz(null)}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex flex-col gap-6">
                {previewQuiz.questions?.map((q: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 p-6 rounded-2xl border-2 border-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Q{idx + 1}</span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{q.points}점</span>
                    </div>
                    <div className="text-lg font-bold text-gray-800 mb-4 break-keep line-clamp-3 prose prose-slate max-w-none [&_p]:m-0">
                      {q.type === 'BLANK' ? (
                        '빈칸 채우기 문제입니다.'
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {processMathText(q.q)}
                        </ReactMarkdown>
                      )}
                    </div>
                    
                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div className="grid grid-cols-1 gap-2">
                        {q.options?.map((opt: string, oIdx: number) => (
                          <div key={oIdx} className={cn(
                            "p-3 rounded-xl border text-sm font-medium flex items-center gap-1 [&_p]:m-0",
                            opt === q.a ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-100 text-gray-500"
                          )}>
                            <span>{oIdx + 1}.</span> 
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                              {processMathText(opt)}
                            </ReactMarkdown>
                            {opt === q.a && '✓'}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {q.type === 'OX' && (
                      <div className="flex gap-4">
                        {['O', 'X'].map(opt => (
                          <div key={opt} className={cn(
                            "flex-1 p-3 rounded-xl border text-center font-black text-xl",
                            opt === q.a ? "bg-emerald-50 border-emerald-200 text-emerald-500" : "bg-white border-gray-100 text-gray-300"
                          )}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'BLANK' && (
                      <div className="p-4 bg-white rounded-xl border border-dashed border-gray-200">
                        <p className="text-sm font-bold text-gray-400 mb-2">지문:</p>
                        <div className="text-indigo-600 font-black mb-3 break-keep prose prose-indigo max-w-none [&_p]:m-0">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {processMathText(q.q)}
                          </ReactMarkdown>
                        </div>
                        <p className="text-sm font-bold text-gray-400 mb-1">정답:</p>
                        <div className="text-emerald-600 font-black prose prose-emerald max-w-none [&_p]:m-0">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {processMathText(q.a)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {(q.type?.toUpperCase() === 'SHORT' || q.type?.toUpperCase() === 'SHORT_ANSWER' || q.type?.toUpperCase() === 'MATH') && (
                      <div className="p-3 bg-white rounded-xl border border-gray-100">
                         <p className="text-sm font-bold text-gray-400 mb-1">정답:</p>
                         <div className="text-indigo-600 font-black prose prose-indigo max-w-none [&_p]:m-0">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {processMathText(q.a)}
                            </ReactMarkdown>
                          </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="ghost" className="rounded-xl px-6" onClick={() => setPreviewQuiz(null)}>
                  닫기
                </Button>
                <Button 
                  variant="primary" 
                  className="rounded-xl px-8 shadow-lg shadow-indigo-100" 
                  onClick={() => {
                    handleCopyQuiz(previewQuiz);
                    setPreviewQuiz(null);
                  }}
                >
                  <Copy size={16} className="mr-2" /> 이 퀴즈 가져오기
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
