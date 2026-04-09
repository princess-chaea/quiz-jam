"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useDialog } from "@/components/ui/DialogProvider";

interface AIQuizContextType {
  text: string;
  setText: (v: string) => void;
  count: number;
  setCount: (v: number) => void;
  types: string[];
  setTypes: (v: string[] | ((prev: string[]) => string[])) => void;
  mathMode: boolean;
  setMathMode: (v: boolean) => void;
  loading: boolean;
  preview: any[] | null;
  setPreview: (v: any[] | null) => void;
  files: File[];
  setFiles: (v: File[] | ((prev: File[]) => File[])) => void;
  generate: () => Promise<void>;
  reset: (full?: boolean) => void;
}

const AIQuizContext = createContext<AIQuizContextType | undefined>(undefined);

export function AIQuizProvider({ children }: { children: React.ReactNode }) {
  const { showAlert } = useDialog();
  
  const [text, setText] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("ai_gen_text") || "";
    return "";
  });
  const [count, setCount] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_gen_count");
      return saved ? parseInt(saved) : 5;
    }
    return 5;
  });
  const [types, setTypes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_gen_types");
      return saved ? JSON.parse(saved) : ["SHORT_ANSWER", "MULTIPLE_CHOICE"];
    }
    return ["SHORT_ANSWER", "MULTIPLE_CHOICE"];
  });
  const [mathMode, setMathMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_gen_math_mode");
      return saved ? saved === "true" : true;
    }
    return true;
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_gen_preview");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [files, setFiles] = useState<File[]>([]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("ai_gen_text", text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem("ai_gen_count", count.toString());
  }, [count]);

  useEffect(() => {
    localStorage.setItem("ai_gen_types", JSON.stringify(types));
  }, [types]);

  useEffect(() => {
    localStorage.setItem("ai_gen_math_mode", mathMode.toString());
  }, [mathMode]);

  useEffect(() => {
    if (preview) {
      localStorage.setItem("ai_gen_preview", JSON.stringify(preview));
    } else {
      localStorage.removeItem("ai_gen_preview");
    }
  }, [preview]);

  const generate = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setPreview(null);
    
    try {
       // 1. Upload files first
       const uploadedFilePaths: { mimeType: string, path: string, name: string }[] = [];

       for (const file of files) {
         const fileExt = file.name.split('.').pop();
         const randomId = Math.random().toString(36).substring(2, 10);
         const fileName = `${Date.now()}-${randomId}.${fileExt}`;
         const filePath = `${fileName}`;

         const { error: uploadError } = await supabase.storage
           .from('ai-temp')
           .upload(filePath, file, {
             contentType: file.type || 'application/octet-stream',
             upsert: false
           });

         if (uploadError) throw new Error(`${file.name} 업로드 실패: ${uploadError.message}`);

         uploadedFilePaths.push({
           mimeType: file.type,
           path: filePath,
           name: file.name
         });
       }

       // 2. Call API
       const res = await fetch("/api/generate", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ text, count, types, storageFiles: uploadedFilePaths, mathMode }),
       });
       
       const data = await res.json();
       if (data.error) throw new Error(data.error);

       const prepared = data.map((q: any) => {
         let processed = { ...q };
         const type = q.type || (types.length === 1 ? types[0] : "SHORT_ANSWER");

         if (type === 'BLANK') {
           let questionText = processed.q || "";
           const bracketRegex = /\{\{(.*?)\}\}/g;
           const matches = [...questionText.matchAll(bracketRegex)];

           if (matches.length > 0) {
             // 1. Extract answers and update q (without brackets)
             const extractedAnswers = matches.map(m => m[1].trim());
             processed.a = extractedAnswers.join(", ");
             
             const cleanQuestion = questionText.replace(/\{\{/g, "").replace(/\}\}/g, "");
             processed.q = cleanQuestion;

             // 2. Re-calculate blanks indices based on cleanQuestion
             const words = cleanQuestion.trim().split(/\s+/).filter(Boolean);
             const detectedBlanks: number[] = [];
             
             let answerPtr = 0;
             words.forEach((word, idx) => {
               if (answerPtr < extractedAnswers.length && word.includes(extractedAnswers[answerPtr])) {
                 detectedBlanks.push(idx);
                 answerPtr++;
               }
             });
             processed.blanks = detectedBlanks;
             // Ensure q is also trimmed for consistency
             processed.q = cleanQuestion.trim();
           } else if (!processed.blanks || processed.blanks.length === 0) {
             // Fallback for old □ or ____ detection
             const words = (processed.q || "").split(/\s+/).filter(Boolean);
             const detectedBlanks: number[] = [];
             words.forEach((word: string, idx: number) => {
               if (word.includes('\\square') || word.includes('□') || word.includes('____')) {
                 detectedBlanks.push(idx);
               }
             });
             if (detectedBlanks.length > 0) processed.blanks = detectedBlanks;
           }
         }

         return {
           ...processed,
           type,
           points: processed.points || 10,
           timeLimit: processed.timeLimit || 20,
           math_mode: mathMode
         };
       });
       
       setPreview(prepared);
    } catch (err) {
      console.error("[AI Context] Error:", err);
      let msg = (err as Error).message;
      if (msg.includes("429") || msg.includes("limit")) {
        msg = "현재 인공지능 서버 사용량이 많습니다. 20초 후 다시 시도해 주세요.";
      }
      showAlert({ message: "문항 생성 실패: " + msg });
    } finally {
      setLoading(false);
    }
  }, [text, count, types, mathMode, loading, showAlert, files]);

  const reset = useCallback((full = false) => {
    setPreview(null);
    setLoading(false);
    if (full) {
      setText("");
      setCount(5);
      setTypes(["SHORT_ANSWER", "MULTIPLE_CHOICE"]);
      setMathMode(true);
      setFiles([]);
      localStorage.removeItem("ai_gen_text");
      localStorage.removeItem("ai_gen_preview");
    }
  }, []);

  return (
    <AIQuizContext.Provider value={{ 
      text, setText, count, setCount, types, setTypes, mathMode, setMathMode,
      loading, preview, setPreview, files, setFiles, generate, reset
    }}>
      {children}
    </AIQuizContext.Provider>
  );
}

export const useAIQuiz = () => {
  const context = useContext(AIQuizContext);
  if (!context) throw new Error("useAIQuiz must be used within an AIQuizProvider");
  return context;
};
