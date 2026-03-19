"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  Save, 
  LayoutDashboard,
  Type,
  HelpCircle,
  Hash,
  GripVertical,
  Sparkles,
  Clock
} from "lucide-react";

import { AIQuizGenerator } from "@/components/dashboard/AIQuizGenerator";
import { useDialog } from "@/components/ui/DialogProvider";
import { Spinner } from "@/components/ui/Spinner";
import { Footer } from "@/components/layout/Footer";
import { MathInput } from "@/components/ui/MathInput";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { processMathText } from "@/lib/utils";

export default function QuizEditor() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const { showAlert } = useDialog();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && id) fetchQuiz();
  }, [user, id]);

  const fetchQuiz = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setQuiz(data);
    } catch (err) {
      console.error("퀴즈 가져오기 실패:", err);
      await showAlert("퀴즈를 불러올 수 없습니다.");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    const newQuestion = { q: "", a: "", type: "SHORT_ANSWER", options: ["", ""], blanks: [], correct_idx: -1, points: 10, timeLimit: 20, math_mode: false };
    setQuiz({ ...quiz, questions: [...quiz.questions, newQuestion] });
  };

  const handleAIGenerated = (newQuestions: any[]) => {
    const prepared = newQuestions.map(q => ({ ...q, timeLimit: q.timeLimit || 20, type: q.type || "SHORT_ANSWER" }));
    setQuiz({ ...quiz, questions: [...quiz.questions, ...prepared] });
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = quiz.questions.filter((_: any, i: number) => i !== index);
    setQuiz({ ...quiz, questions: newQuestions });
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuiz((prev: any) => {
      if (!prev) return prev;
      const newQuestions = [...prev.questions];
      newQuestions[index] = { ...newQuestions[index], [field]: value };
      return { ...prev, questions: newQuestions };
    });
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    // Add a slight transparency to the dragged item
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.5";
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newQuestions = [...quiz.questions];
    const draggedItem = newQuestions[draggedIndex];
    newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(index, 0, draggedItem);
    
    setQuiz({ ...quiz, questions: newQuestions });
    setDraggedIndex(index);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedIndex(null);
  };

  const handleSave = async (redirect = false) => {
    if (!quiz.title.trim()) {
      await showAlert("퀴즈 제목을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ 
          title: quiz.title, 
          questions: quiz.questions,
          is_public: quiz.is_public ?? true,
          school_level: quiz.school_level || null,
          subjects: quiz.subjects || []
        })
        .eq("id", id);

      if (error) throw error;
      await showAlert("저장되었습니다!");
      if (redirect) router.push("/dashboard");
    } catch (err) {
      await showAlert("저장 실패: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner fullScreen label="퀴즈 불러오는 중..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {showAI && (
        <AIQuizGenerator 
          onQuestionsGenerated={handleAIGenerated} 
          onClose={() => setShowAI(false)} 
        />
      )}

      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-indigo-600"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Quiz Editor</span>
            <input 
              type="text" 
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              className="text-xl font-jua text-gray-900 outline-none border-b-2 border-transparent focus:border-indigo-400 bg-transparent transition-all"
              placeholder="퀴즈 제목을 입력하세요"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="yellow" 
            className="rounded-xl px-4 py-2"
            onClick={() => setShowAI(true)}
          >
            <Sparkles size={18} className="mr-2" /> AI 문항 생성
          </Button>
          <Button 
            variant="primary" 
            className="rounded-xl px-6 py-2 shadow-lg shadow-indigo-100"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            <Save size={18} className="mr-2" /> {saving ? '저장 중...' : '저장 후 나가기'}
          </Button>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto p-8">
        <div className="space-y-6">
          {/* Library Settings */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 relative animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Sparkles className="text-yellow-500" size={24}/> 라이브러리 공유 설정
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 border-t border-gray-100 pt-6">
              <div className="space-y-4">
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={quiz.is_public !== false} 
                      onChange={(e) => setQuiz({...quiz, is_public: e.target.checked})} 
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${quiz.is_public !== false ? 'bg-indigo-500' : 'bg-gray-200'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${quiz.is_public !== false ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="font-bold text-gray-700 text-lg">전체 공개</span>
                </label>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  다른 선생님들이 이 퀴즈를 라이브러리에서<br/>검색하고 수업에 활용할 수 있습니다.
                </p>
              </div>

              <div className={`space-y-6 transition-all duration-500 ${quiz.is_public !== false ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">학교 급별</label>
                  <div className="flex gap-2">
                    {['초등', '중', '고등'].map(level => (
                      <button
                        key={level}
                        onClick={() => setQuiz({...quiz, school_level: level})}
                        className={`px-5 py-2 rounded-xl font-bold transition-all border-2 ${quiz.school_level === level ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:border-gray-200'}`}
                      >{level}학교</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">관련 과목</label>
                  <div className="flex flex-wrap gap-2">
                    {['국어', '수학', '사회', '과학', '영어', '정보', '기타'].map(subj => {
                      const isSelected = (quiz.subjects || []).includes(subj);
                      return (
                        <button
                          key={subj}
                          onClick={() => {
                            const newSubjects = isSelected 
                              ? (quiz.subjects || []).filter((s: string) => s !== subj)
                              : [...(quiz.subjects || []), subj];
                            setQuiz({...quiz, subjects: newSubjects});
                          }}
                          className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all border-2 ${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:border-gray-200'}`}
                        >{subj}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {quiz.questions.map((q: any, index: number) => (
            <div 
              key={index} 
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`group bg-white rounded-3xl p-8 shadow-sm border border-gray-200 relative animate-pop hover:shadow-xl hover:shadow-indigo-50 transition-all ${draggedIndex === index ? 'opacity-50 ring-4 ring-indigo-200' : ''}`}
            >
              {/* Drag Handle */}
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white border border-gray-100 shadow-md p-2 rounded-xl text-gray-300 hidden md:flex items-center justify-center cursor-move hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                <GripVertical size={20} />
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-sm font-black">
                      Problem #{index + 1}
                    </span>
                    <button
                      onClick={() => updateQuestion(index, "math_mode", !q.math_mode)}
                      className={`text-xs font-black px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${q.math_mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-transparent text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span>∑</span> 수식 모드
                    </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => updateQuestion(index, "type", "SHORT_ANSWER")}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${q.type === "SHORT_ANSWER" ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'}`}
                          >단답형</button>
                          <button
                            onClick={() => updateQuestion(index, "type", "MULTIPLE_CHOICE")}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${q.type === "MULTIPLE_CHOICE" ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'}`}
                          >선다형</button>
                          <button
                            onClick={() => updateQuestion(index, "type", "OX")}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${q.type === "OX" ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'}`}
                          >O/X 퀴즈</button>
                          <button
                            onClick={() => updateQuestion(index, "type", "BLANK")}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${q.type === "BLANK" ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'}`}
                          >빈칸 넣기</button>
                        </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveQuestion(index)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Question */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <Type size={14} /> Question
                        </label>
                      </div>
                      
                      <div className="space-y-3">
                        {q.math_mode ? (
                          <MathInput
                            value={q.q}
                            onChange={(value) => updateQuestion(index, "q", value)}
                            className="w-full"
                            containerClassName="min-h-[140px] flex flex-col"
                            placeholder="질문을 입력하세요. 수식은 가상 키보드를 사용하여 입력할 수 있습니다."
                            isTeacher={true}
                          />
                        ) : (
                          <textarea 
                            value={q.q}
                            onChange={(e) => updateQuestion(index, "q", e.target.value)}
                            className="w-full p-4 text-lg font-bold border-2 border-slate-100 bg-slate-50/50 rounded-2xl focus:border-indigo-400 focus:bg-white outline-none transition-all placeholder:text-slate-300 min-h-[100px] resize-none"
                            placeholder="질문을 입력하세요. 수식은 \frac{1}{2} 처럼 LaTeX로 입력하면 미리보기에 표시됩니다."
                            rows={3}
                          />
                        )}
                      </div>
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Answer Section based on type */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <HelpCircle size={14} /> 
                        {q.type === "MULTIPLE_CHOICE" ? "Options & Answer" : 
                         q.type === "OX" ? "Select Correct Answer" :
                         q.type === "BLANK" ? "Set Blanks (Click words below)" : "Correct Answer"}
                      </label>
                       
                      {q.type === "MULTIPLE_CHOICE" ? (
                        <div className="space-y-2">
                          <div className="flex flex-col gap-2">
                            {(q.options || ["", ""]).map((opt: string, optIdx: number) => {
                              // If correct_idx exists, use it. Otherwise fallback to value match for legacy data.
                              const isCorrect = q.correct_idx !== undefined ? q.correct_idx === optIdx : (q.a === opt && opt !== "");
                              return (
                                <div key={optIdx} className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                                  <input 
                                    type="radio" 
                                    name={`correct-${index}`}
                                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                    checked={isCorrect}
                                    onChange={() => {
                                      updateQuestion(index, "a", opt);
                                      updateQuestion(index, "correct_idx", optIdx);
                                    }}
                                  />
                                  <div className="flex-1 bg-transparent">
                                    {q.math_mode ? (
                                      <MathInput
                                        value={opt}
                                        onChange={(value) => {
                                          const newOpts = [...(q.options || ["", ""])];
                                          newOpts[optIdx] = value;
                                          updateQuestion(index, "options", newOpts);
                                          if (isCorrect) updateQuestion(index, "a", value);
                                        }}
                                        className="w-full font-bold text-slate-700 text-sm"
                                        placeholder={`수식 보기 ${optIdx + 1}`}
                                        isTeacher={true}
                                      />
                                    ) : (
                                      <div className="flex-1 space-y-1">
                                        <input 
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOpts = [...(q.options || ["", ""])];
                                            newOpts[optIdx] = e.target.value;
                                            updateQuestion(index, "options", newOpts);
                                            if (isCorrect) updateQuestion(index, "a", e.target.value);
                                          }}
                                          className="w-full bg-transparent outline-none font-bold text-slate-700 text-sm placeholder:text-slate-300 placeholder:font-medium py-2"
                                          placeholder={`보기 ${optIdx + 1}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  {(q.options || []).length > 2 && (
                                    <button 
                                      onClick={() => {
                                        const newOpts = (q.options || []).filter((_: any, i: number) => i !== optIdx);
                                        updateQuestion(index, "options", newOpts);
                                        if (q.a === opt) updateQuestion(index, "a", "");
                                      }}
                                      className="p-1 text-slate-300 hover:text-red-500"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {(q.options || []).length < 4 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-400 py-2 rounded-xl"
                              onClick={() => {
                                const newOpts = [...(q.options || ["", ""]), ""];
                                updateQuestion(index, "options", newOpts);
                              }}
                            >
                              <Plus size={14} className="mr-1" /> 보기 추가
                            </Button>
                          )}
                          <p className="text-[10px] text-slate-400 font-bold px-1 mt-1">체크박스를 눌러 정답을 지정하세요.</p>
                        </div>
                      ) : q.type === "OX" ? (
                        <div className="flex gap-4">
                          {["O", "X"].map(opt => (
                            <button
                              key={opt}
                              onClick={() => updateQuestion(index, "a", opt)}
                              className={`flex-1 py-4 rounded-2xl border-2 font-black text-2xl transition-all ${q.a === opt ? 'border-emerald-400 bg-emerald-50 text-emerald-600 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : q.type === "BLANK" ? (
                         <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 min-h-[100px] flex flex-wrap gap-2 content-start">
                              {q.q.split(/\s+/).filter(Boolean).map((word: string, wordIdx: number) => {
                                const blanks = q.blanks || [];
                                const blankIndex = blanks.indexOf(wordIdx);
                                const isBlank = blankIndex !== -1;
                                return (
                                  <button
                                    key={wordIdx}
                                    onClick={() => {
                                      const newBlanks = isBlank 
                                        ? blanks.filter((id: number) => id !== wordIdx)
                                        : [...blanks, wordIdx].sort((a, b) => a - b);
                                      updateQuestion(index, "blanks", newBlanks);
                                      
                                      const words = q.q.split(/\s+/).filter(Boolean);
                                      const blankWords = words.filter((_: any, i: number) => newBlanks.includes(i));
                                      updateQuestion(index, "a", blankWords.join(", "));
                                    }}
                                    className={`relative px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${isBlank ? 'bg-indigo-600 text-white shadow-md scale-105 pr-8' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                  >
                                    {word}
                                    {isBlank && (
                                      <span className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
                                        {blankIndex + 1}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              {(!q.q || q.q.trim().length === 0) && <p className="text-slate-300 text-sm font-medium italic">질문을 먼저 입력해주세요.</p>}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold px-1 mt-1">질문의 단어를 클릭하여 빈칸으로 만드세요. 번호 순서대로 학생이 입력하게 됩니다.</p>
                         </div>
                      ) : (
                        q.math_mode ? (
                          <div className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl focus-within:border-indigo-400 focus-within:bg-white transition-all overflow-hidden flex items-center min-h-[64px]">
                            <MathInput 
                              value={q.a}
                              onChange={(value) => updateQuestion(index, "a", value)}
                              className="w-full font-bold bg-transparent px-4"
                              placeholder="수식 정답을 입력하세요"
                              isTeacher={true}
                            />
                          </div>
                        ) : (
                          <input 
                            type="text"
                            value={q.a}
                            onChange={(e) => updateQuestion(index, "a", e.target.value)}
                            className="w-full p-4 font-bold border-2 border-gray-50 bg-gray-50 rounded-2xl focus:border-indigo-400 focus:bg-white outline-none transition-all placeholder:text-gray-300"
                            placeholder="일반 텍스트 정답을 입력하세요"
                          />
                        )
                      )}
                    </div>

                    <div className="flex flex-col gap-6">
                      {/* Points Slider */}
                      <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <Hash size={14} /> Points
                            </label>
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full">{q.points}pt</span>
                         </div>
                         <div className="px-2">
                            <input 
                              type="range"
                              min="10"
                              max="50"
                              step="10"
                              value={q.points}
                              onChange={(e) => updateQuestion(index, "points", parseInt(e.target.value))}
                              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-slate-200"
                            />
                            <div className="flex justify-between text-[10px] font-black text-slate-300 mt-2 px-1">
                               <span>10</span>
                               <span>20</span>
                               <span>30</span>
                               <span>40</span>
                               <span>50</span>
                            </div>
                         </div>
                      </div>
                      
                      {/* Time Limit Slider */}
                      <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock size={14} /> Time Limit
                            </label>
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full">{q.timeLimit || 20}s</span>
                         </div>
                         <div className="px-2">
                            <input 
                              type="range"
                              min="5"
                              max="120"
                              step="5"
                              value={q.timeLimit || 20}
                              onChange={(e) => updateQuestion(index, "timeLimit", parseInt(e.target.value))}
                              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-slate-200"
                            />
                            <div className="flex justify-between text-[10px] font-black text-slate-300 mt-2 px-1">
                               <span>5s</span>
                               <span>30s</span>
                               <span>60s</span>
                               <span>90s</span>
                               <span>120s</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <button 
            onClick={handleAddQuestion}
            className="w-full py-12 border-4 border-dashed border-gray-200 rounded-3xl text-gray-300 hover:text-indigo-400 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-white transition-colors group-hover:shadow-lg group-hover:shadow-indigo-100">
              <Plus size={32} />
            </div>
            <span className="text-xl font-jua">문제 추가하기</span>
          </button>
        </div>
      </main>

      {/* Floating Action Menu */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur-xl border border-white shadow-2xl p-4 rounded-3xl z-30">
        <Button variant="ghost" className="rounded-2xl px-6 text-gray-400" onClick={() => router.push("/dashboard")}>나가기</Button>
        <div className="h-8 w-px bg-gray-200" />
        <Button 
          variant="primary" 
          className="rounded-2xl px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {saving ? '저장 중...' : '변경사항 저장'}
        </Button>
      </div>
      
      <Footer />
    </div>
  );
}
