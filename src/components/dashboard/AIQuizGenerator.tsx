"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles, Loader2, Plus, X, ListOrdered } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface AIQuizGeneratorProps {
  onQuestionsGenerated: (questions: any[]) => void;
  onClose: () => void;
}

export function AIQuizGenerator({ onQuestionsGenerated, onClose }: AIQuizGeneratorProps) {
  const [text, setText] = useState("");
  const [filesData, setFilesData] = useState<{ mimeType: string, data: string, name: string }[]>([]);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<string[]>(["SHORT_ANSWER", "MULTIPLE_CHOICE", "MATH"]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const { showAlert } = useDialog();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newFilesData: { mimeType: string, data: string, name: string }[] = [];

    for (const file of files) {
      // Check file size limit (2MB)
      if (file.size > 2 * 1024 * 1024) {
        await showAlert(`'${file.name}' 파일 용량이 너무 큽니다. 2MB 이하의 파일만 업로드할 수 있습니다.`);
        continue;
      }

      // Encode as base64 for Gemini
      const reader = new FileReader();
      const filePromise = new Promise<{ mimeType: string, data: string, name: string }>((resolve, reject) => {
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const match = result.match(/data:(.*);base64,(.*)/);
          if (match) {
            resolve({ mimeType: file.type || match[1], data: match[2], name: file.name });
          } else {
            reject(new Error(`'${file.name}' 파일을 읽을 수 없습니다.`));
          }
        };
        reader.onerror = () => reject(new Error(`'${file.name}' 읽기 오류`));
        reader.readAsDataURL(file);
      });

      try {
        const data = await filePromise;
        newFilesData.push(data);
      } catch (err: any) {
        showAlert(err.message);
      }
    }

    setFilesData(prev => [...prev, ...newFilesData]);
    // Reset input value so same file can be selected again if removed
    e.target.value = "";
  };

  const toggleType = (t: string) => {
    setTypes(prev => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(x => x !== t);
      }
      return [...prev, t];
    });
  };

  const handleGenerate = async () => {
    if (!text.trim() && filesData.length === 0) {
      await showAlert("학습 자료를 입력하거나 파일을 첨부해주세요.");
      return;
    }
    if (types.length === 0) {
      await showAlert("최소 1개의 문제 유형을 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, count, types, filesData }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Ensure the generated questions have a type falling back to SHORT_ANSWER
      const preparedQuestions = data.map((q: any) => ({
        ...q,
        type: q.type || (types.length === 1 ? types[0] : "SHORT_ANSWER"),
        points: q.points || 10,
        timeLimit: 20
      }));
      setPreview(preparedQuestions);
    } catch (err) {
      await showAlert("생성 실패: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (preview) {
      onQuestionsGenerated(preview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-pop">
        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
             <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-jua flex items-center gap-2">
              <Sparkles size={24} /> 제미나이 AI 문항 생성
            </h3>
            <p className="text-white/70 text-sm font-bold mt-1">학습 자료만 넣으면 퀴즈가 뚝딱!</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-xl transition-colors relative z-10">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {!preview ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[10px]">1</span>
                    학습 자료 입력 (또는 파일 업로드)
                  </label>
                  <label className="cursor-pointer text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg text-sm font-bold transition-colors">
                    {filesData.length > 0 ? '+ 파일 더 추가' : '+ 파일 첨부'}
                    <input 
                      type="file" 
                      multiple 
                      accept=".txt,.csv,.md,.pdf,.png,.jpg,.jpeg,.gif,.webp,.js,.py,.html,.css,.doc,.docx,.xls,.xlsx,.ppt,.pptx" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                </div>
                {filesData.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {filesData.map((file, idx) => (
                      <div key={idx} className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-left-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-xl flex items-center justify-center font-bold">
                            {file.mimeType.startsWith('image/') ? '🖼️' : '📄'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[10px] text-slate-400">첨부됨 (AI가 즉시 분석합니다)</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setFilesData(prev => prev.filter((_, i) => i !== idx))} 
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                        >
                          <X size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="또는 여기에 교과 전개 내용이나 요약본을 직접 입력하세요..."
                  className="w-full h-32 p-6 text-base border-2 border-slate-100 bg-slate-50 rounded-3xl focus:border-indigo-400 focus:bg-white outline-none transition-all resize-none shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[10px]">2</span>
                  문제 유형 (중복 선택 가능)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "SHORT_ANSWER", label: "단답형" },
                    { id: "MULTIPLE_CHOICE", label: "선다형" },
                    { id: "OX", label: "O/X 퀴즈" },
                    { id: "BLANK", label: "빈칸 넣기" },
                    { id: "MATH", label: "수학(수식)" }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => toggleType(type.id)}
                      className={`p-3 rounded-xl border-2 font-bold transition-all ${types.includes(type.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[10px]">3</span>
                    문항 수 선택
                  </label>
                  <span className="text-xl font-black text-indigo-600 bg-indigo-50 px-4 py-1 rounded-full">{count}문항</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-slate-200"
                />
                <div className="flex justify-between text-[10px] font-black text-slate-300 px-1">
                   <span>1</span>
                   <span>5</span>
                   <span>10</span>
                   <span>15</span>
                </div>
              </div>

              <Button
                size="xl"
                className="w-full py-8 text-2xl shadow-xl shadow-indigo-100 group"
                onClick={handleGenerate}
                disabled={loading || (!text.trim() && filesData.length === 0)}
              >

                {loading ? (
                  <><Loader2 className="mr-2 animate-spin" /> 문항 만드는 중...</>
                ) : (
                  <><Sparkles className="mr-2 group-hover:animate-pulse" /> 퀴즈 문항 생성하기</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-xl font-jua text-slate-800 flex items-center gap-2">
                   <ListOrdered size={20} className="text-indigo-600" /> 생성된 문항 미리보기
                 </h4>
                 <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setPreview(null)}>다시 만들기</Button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {preview.map((q, i) => (
                  <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex gap-4">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 mb-2 leading-tight [&_p]:m-0">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.q}</ReactMarkdown>
                      </div>
                      {q.type === "MULTIPLE_CHOICE" && q.options && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {q.options.map((opt: string, idx: number) => (
                            <div key={idx} className={`p-2 rounded-lg text-sm font-medium border flex items-center gap-1 ${opt === q.a ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600"}`}>
                              <span>{idx + 1}.</span>
                              <div className="[&_p]:m-0 [&_p]:inline">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                                  {opt}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-indigo-600 font-black text-sm flex items-center gap-1 [&_p]:m-0">
                        <span className="text-slate-400 font-bold">{q.type === "MULTIPLE_CHOICE" ? "정답:" : "A."}</span> 
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                          {q.a}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 flex gap-3">
                <Button variant="ghost" className="flex-1 py-4" onClick={() => setPreview(null)}>취소</Button>
                <Button variant="primary" className="flex-2 py-4 px-12 rounded-2xl shadow-lg shadow-indigo-100" onClick={handleAdd}>
                   <Plus size={20} className="mr-2" /> 퀴즈에 추가하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
