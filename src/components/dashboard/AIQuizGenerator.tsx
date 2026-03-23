"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles, Loader2, Plus, X, ListOrdered } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { processMathText, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface AIQuizGeneratorProps {
  onQuestionsGenerated: (questions: any[]) => void;
  onClose: () => void;
}

export function AIQuizGenerator({ onQuestionsGenerated, onClose }: AIQuizGeneratorProps) {
  const [text, setText] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ai_gen_text") || "";
    }
    return "";
  });
  const [files, setFiles] = useState<File[]>([]);
  const [count, setCount] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("ai_gen_count");
      return saved ? parseInt(saved) : 5;
    }
    return 5;
  });
  const [types, setTypes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("ai_gen_types");
      return saved ? JSON.parse(saved) : ["SHORT_ANSWER", "MULTIPLE_CHOICE"];
    }
    return ["SHORT_ANSWER", "MULTIPLE_CHOICE"];
  });
  const [mathMode] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("ai_gen_preview");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const { showAlert } = useDialog();

  // Persist state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("ai_gen_text", text);
  }, [text]);

  useEffect(() => {
    sessionStorage.setItem("ai_gen_count", count.toString());
  }, [count]);

  useEffect(() => {
    sessionStorage.setItem("ai_gen_types", JSON.stringify(types));
  }, [types]);


  useEffect(() => {
    if (preview) {
      sessionStorage.setItem("ai_gen_preview", JSON.stringify(preview));
    } else {
      sessionStorage.removeItem("ai_gen_preview");
    }
  }, [preview]);

  const processFiles = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    const validFiles: File[] = [];

    for (const file of newFiles) {
      if (file.size > 20 * 1024 * 1024) {
        await showAlert(`'${file.name}' 파일 용량이 너무 큽니다. 20MB 이하의 파일만 업로드할 수 있습니다.`);
        continue;
      }
      validFiles.push(file);
    }

    setFiles((prev: File[]) => [...prev, ...validFiles]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    await processFiles(newFiles);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    await processFiles(droppedFiles);
  };

  const toggleType = (t: string) => {
    setTypes((prev: string[]) => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((x: string) => x !== t);
      }
      return [...prev, t];
    });
  };

  const handleGenerate = async () => {
    if (!text.trim() && files.length === 0) {
      await showAlert("학습 자료를 입력하거나 파일을 첨부해주세요.");
      return;
    }
    if (types.length === 0) {
      await showAlert("최소 1개의 문제 유형을 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      // 1. Upload files to Supabase ai-temp bucket first
      const uploadedFilePaths: { mimeType: string, path: string, name: string }[] = [];

      const totalSize = files.reduce((acc: number, f: File) => acc + f.size, 0);
      if (totalSize > 50 * 1024 * 1024) {
        throw new Error("첨부된 전체 파일 용량이 너무 큽니다 (최대 50MB). 일부 파일을 제외해주세요.");
      }

      for (const file of files) {
        if (!file) continue;
        console.log(`[AI Generator] Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);

        const fileExt = file.name.split('.').pop();
        const randomId = Math.random().toString(36).substring(2, 10);
        const fileName = `${Date.now()}-${randomId}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ai-temp')
          .upload(filePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false
          });

        if (uploadError) {
          console.error("[AI Generator] Supabase Storage upload error details:", JSON.stringify(uploadError, null, 2));
          let msg = uploadError.message;
          if (msg.includes("Bucket not found")) {
            msg = "Supabase에 'ai-temp' 버킷이 없습니다. Supabase SQL Editor에서 'INSERT INTO storage.buckets (id, name, public) VALUES ('ai-temp', 'ai-temp', true);' 명령어를 실행해 주세요.";
          }
          throw new Error(`${file.name} 업로드 실패 (Status: ${uploadError.status || 'unknown'}): ${msg}`);
        }

        console.log(`[AI Generator] Successfully uploaded ${file.name} to ${filePath}`);

        uploadedFilePaths.push({
          mimeType: file.type,
          path: filePath,
          name: file.name
        });
      }

      // 2. Call generate API with file paths
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, count, types, storageFiles: uploadedFilePaths, mathMode }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const preparedQuestions = data.map((q: any) => {
        let processed = { ...q };

        // Ensure type consistency
        const type = q.type || (types.length === 1 ? types[0] : "SHORT_ANSWER");

        // Fallback for BLANK type: if AI used markers but didn't provide blanks array
        if (type === 'BLANK' && (!processed.blanks || processed.blanks.length === 0)) {
          console.log("[AI Generator] Fallback: Detecting blanks from markers in text");
          const words = (processed.q || "").split(/\s+/).filter(Boolean);
          const detectedBlanks: number[] = [];

          words.forEach((word: string, idx: number) => {
            if (word.includes('\\square') || word.includes('□') || word.includes('____')) {
              detectedBlanks.push(idx);
            }
          });

          if (detectedBlanks.length > 0) {
            processed.blanks = detectedBlanks;
            // If answer 'a' is also missing or just the marker, try to sync it if possible
            // But usually we can't know the answer if it's just a marker.
            // At least the UI will highlight the blank now.
          }
        }

        return {
          ...processed,
          type,
          points: processed.points || 10,
          timeLimit: 20,
          math_mode: mathMode
        };
      });
      setPreview(preparedQuestions);
    } catch (err) {
      console.error("[AI Generator] Error:", err);
      let errorMsg = (err as Error).message;

      if (errorMsg.includes("payload") || errorMsg.includes("too large") || errorMsg.includes("413")) {
        errorMsg = "첨부파일 용량이 너무 커서 인공지능이 처리할 수 없습니다. 더 작은 파일을 사용하거나 파일 개수를 줄여주세요.";
      } else if (errorMsg.includes("JSON")) {
        errorMsg = "인공지능이 응답 형식을 맞추지 못했습니다. 다시 시도해 주세요.";
      } else if (errorMsg.includes("할당량") || errorMsg.includes("limit") || errorMsg.includes("429")) {
        errorMsg = "현재 인공지능 사용량이 많아 할당량이 초과되었습니다. 약 30초~1분 후 다시 시도해 주세요.\n(팁: 파일 용량이 크면 할당량을 더 빨리 소모합니다.)";
      }

      await showAlert("문항 생성 실패: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (preview) {
      onQuestionsGenerated(preview);
      sessionStorage.removeItem("ai_gen_preview");
      sessionStorage.removeItem("ai_gen_text");
      sessionStorage.removeItem("ai_gen_count");
      sessionStorage.removeItem("ai_gen_types");
      sessionStorage.removeItem("ai_gen_math_mode");
      onClose();
    }
  };

  const handleClose = async () => {
    if (loading) {
      const confirmClose = window.confirm("문항 생성 중입니다. 정말 닫으시겠습니까?");
      if (!confirmClose) return;
    }
    if (preview && preview.length > 0) {
      const confirmClose = window.confirm("생성된 문항이 있습니다. 퀴즈에 추가하지 않고 닫으시겠습니까?");
      if (!confirmClose) return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-jua flex items-center gap-2">
              <Sparkles size={24} /> AI 문항 생성
            </h3>
            <p className="text-white/70 text-sm font-bold mt-1">학습 자료만 넣으면 퀴즈가 뚝딱!</p>
          </div>
          <button onClick={handleClose} className="hover:bg-white/20 p-2 rounded-xl transition-colors relative z-10">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {!preview ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div 
                className={cn(
                  "space-y-3 p-4 rounded-[2rem] border-2 border-transparent transition-all",
                  isDragging ? "bg-indigo-50/50 border-indigo-400 border-dashed" : ""
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[10px]">1</span>
                    학습 자료 입력 (또는 파일 업로드)
                  </label>
                  <label className="cursor-pointer text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg text-sm font-bold transition-colors">
                    {files.length > 0 ? '+ 파일 더 추가' : '+ 파일 첨부'}
                    <input
                      type="file"
                      multiple
                      accept=".txt,.csv,.md,.pdf,.png,.jpg,.jpeg,.gif,.webp,.js,.py,.html,.css,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {files.map((file, idx) => (
                      <div key={idx} className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-left-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-xl flex items-center justify-center font-bold">
                            {file.type.startsWith('image/') ? '🖼️' : '📄'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[10px] text-slate-400">첨부됨 (AI가 즉시 분석합니다)</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                        >
                          <X size={16} />
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
                <div className="flex flex-col gap-4">

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "SHORT_ANSWER", label: "단답형" },
                      { id: "MULTIPLE_CHOICE", label: "선다형" },
                      { id: "OX", label: "O/X 퀴즈" },
                      { id: "BLANK", label: "빈칸 넣기" }
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
                disabled={loading || (!text.trim() && files.length === 0)}
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
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{processMathText(q.q)}</ReactMarkdown>
                      </div>
                      {q.type === "MULTIPLE_CHOICE" && q.options && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {q.options.map((opt: string, idx: number) => (
                            <div key={idx} className={`p-2 rounded-lg text-sm font-medium border flex items-center gap-1 ${opt === q.a ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600"}`}>
                              <span>{idx + 1}.</span>
                              <div className="[&_p]:m-0 [&_p]:inline">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                                  {processMathText(opt)}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-indigo-600 font-black text-sm flex flex-col gap-1">
                        <div className="flex items-center gap-1 [&_p]:m-0">
                          <span className="text-slate-400 font-bold">{q.type === "MULTIPLE_CHOICE" ? "정답:" : "A."}</span>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                            {processMathText(q.a)}
                          </ReactMarkdown>
                        </div>
                        {q.math_mode && q.template && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                            <span className="font-bold">양식:</span>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
                              {processMathText(q.template)}
                            </ReactMarkdown>
                          </div>
                        )}
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
