import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Buffer } from "buffer";

export async function POST(req: Request) {
  try {
    const {
      text,
      count = 5,
      types = ["SHORT_ANSWER"],
      filesData = [],
      storageFiles = [],
      mathMode = false
    } = await req.json();

    if (!text && filesData.length === 0 && storageFiles.length === 0) {
      return NextResponse.json({ error: "텍스트나 파일이 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "Gemini API Key가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 추가해주세요."
      }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const typeLabel = types.map((t: string) => {
      if (t === "MULTIPLE_CHOICE") return "선다형(2-4개 보기)";
      if (t === "SHORT_ANSWER") return "단답형";
      if (t === "OX") return "O/X 퀴즈";
      if (t === "BLANK") return "빈칸 넣기";
      if (t === "MATH") return "수학(수식) 문제";
      return t;
    }).join(", ");

    const formatPrompt = `[
  {
    "q": "질문 내용",
    "options": ["보기1", "보기2"], 
    "a": "정답",
    "type": "SHORT_ANSWER",
    "blanks": [],
    "points": 10,
    "math_mode": false,
    "template": ""
  }
]`;

    const textPrompt = "당신은 대한민국 최고의 문항 출제 전문가입니다. " +
      "제공된 학습 자료를 분석하여 " + count + "개의 고품질 퀴즈 문항을 생성해주세요.\n\n" +
      "[핵심 출제 원칙]\n" +
      "- 전문성: 사고력을 요하는 문항을 구성하세요.\n" +
      "- 일관성: 요청된 유형(" + typeLabel + ")에 충실하세요.\n" +
      "- 언어: 모든 문장은 자연스러운 한국어 경어체(~요, ~까요?)를 사용하세요.\n" +
      "- 수학(math_mode): 정답 입력에 분수, 루트 등이 필요한 경우만 math_mode를 true로 설정하세요.\n\n" +
      "[퀴즈 유형별 규칙]\n" +
      "1. SHORT_ANSWER/MATH: 질문에서 '빈칸'을 의미하는 \\\\square 또는 □ 기호 사용을 엄격히 금지합니다. " +
      "대신 전체 문맥을 설명한 뒤 \"~은 무엇일까요?\" 또는 \"~의 값은 얼마입니까?\"와 같이 완전한 질문 형태로 작성하세요.\n" +
      "2. MATH: 모든 수식은 LaTeX 형식을 사용하세요 (예: \\\\frac{1}{2}).\n" +
      "3. MULTIPLE_CHOICE: 보기(options)에도 LaTeX를 활용하세요.\n" +
      "4. BLANK: 'q' 필드에 빈칸이 포함된 전체 문장을 쓰고, 'blanks'에 인덱스를 넣으세요.\n\n" +
      "[수식 및 JSON 규칙]\n" +
      "- 분수는 반드시 \\\\frac{분자}{분모} 형식을 사용하세요. / 기호를 금지합니다.\n" +
      "- JSON 출력 시 백슬래시는 반드시 4번(\\\\\\\\\\\\) 이스케이프 하세요.\n\n" +
      "형식:\n" + formatPrompt + "\n\n" +
      "학습 자료:\n" + (text || "첨부 파일 참조");

    const parts: any[] = [{ text: textPrompt }];

    for (const file of filesData) {
      parts.push({
        inlineData: { mimeType: file.mimeType, data: file.data }
      });
    }

    const tempFilePaths: string[] = [];
    let extractedText = "";

    for (const file of storageFiles) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('ai-temp')
        .download(file.path);

      if (downloadError) {
        console.error(`Error downloading ${file.path}:`, downloadError);
        continue;
      }

      tempFilePaths.push(file.path);
      const isMedia = file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf';

      if (isMedia) {
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          parts.push({
            inlineData: { mimeType: file.mimeType, data: base64 }
          });
        } catch (err) {
          console.error(`Buffer error for ${file.path}:`, err);
        }
      } else {
        try {
          const textContent = await fileData.text();
          extractedText += `\n\n[File: ${file.name}]\n${textContent}`;
        } catch (err) {
          console.error(`Text extraction error for ${file.path}:`, err);
        }
      }
    }

    if (extractedText) {
      parts[0].text += `\n\n추가 학습 자료:${extractedText}`;
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI가 유효한 JSON 형식을 생성하지 못했습니다.");
    }

    if (tempFilePaths.length > 0) {
      supabase.storage.from('ai-temp').remove(tempFilePaths).catch(e => console.error("Cleanup error:", e));
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(questions);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({
      error: error.message || "오류가 발생했습니다.",
      details: error.stack
    }, { status: 500 });
  }
}
