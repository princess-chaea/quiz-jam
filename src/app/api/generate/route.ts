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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    "timeLimit": 60,
    "math_mode": false,
    "template": ""
  }
]`;

    const textPrompt = "당신은 대한민국 최고의 문항 출제 전문가입니다. " +
      "제공된 학습 자료의 핵심 교육 개념을 분석하여 " + count + "개의 고품질 퀴즈 문항을 생성해주세요.\n\n" +
      "[핵심 출제 원칙]\n" +
      "- 개념 중심: 학습 자료에 나타난 주요 개념, 원리, 용어를 묻는 문제 위주로 구성하세요.\n" +
      "- 문제 스타일 최적화: 단순 사칙연산(예: '~를 곱하세요', '~를 나누세요')은 지문 없이 깔끔한 계산식(예: $2 \\times 5 \\div 2 = ?$)으로만 구성하세요. 반면, 사고력이 필요한 응용 문제는 실생활 맥락을 담은 문장제(Word Problem) 형식으로 출제하여 학습 동기를 유발하세요.\n" +
      "- 메타 질문 금지: 자료 자체에 대한 질문(차시, 제목, 목표 등)은 절대 금지합니다.\n" +
      "- 깔끔명료함: 정답('a')은 불필요한 괄호나 설명 없이 핵심 정답만 제시하세요.\n" +
      "- 초등 수준 기호: 초등학교 수준(elementary)에서는 분수($\\frac{a}{b}$)보다는 나누기 기호($\\div$)를, 점($\\cdot$)보다는 곱하기 기호($\\times$)를 우선적으로 사용하세요.\n" +
      "- 수식(math_mode): 정답 입력에 수식이 필요한 경우만 true로 설정하세요. 질문('q') 내의 텍스트와 수식이 혼합된 경우, 텍스트 부분의 띄어쓰기가 무시되지 않도록 수식 기호($)를 수식 부분에만 정확히 사용하거나 텍스트를 \\text{...}로 감싸세요.\n\n" +
      "[퀴즈 유형별 규칙]\n" +
      "1. SHORT_ANSWER: 정답은 반드시 단어, 숫자, 또는 매우 짧은 구절이어야 합니다.\n" +
      "2. MATH: 모든 수식은 LaTeX 형식을 사용하세요.\n" +
      "3. MULTIPLE_CHOICE: 보기(options)는 4지선다형을 기본으로 합니다. 정답('a')은 반드시 보기 중 하나와 글자 하나 틀리지 않고 정확히 일치하는 텍스트여야 합니다. (숫자 1, 2, 3 대신 실제 텍스트를 넣으세요)\n" +
      "4. BLANK: 문맥상 아주 중요한 용어나 수치에 빈칸을 만드세요.\n\n" +
      "[수식 및 JSON 규칙]\n" +
      "- 분수는 \\frac{분자}{분모} 형식을 사용하세요. 곱하기는 \\times, 나누기는 \\div를 사용하세요. (백슬래시 하나 사용)\n" +
      "- JSON 응답 시 백슬래시가 포함된 문자열을 올바르게 이스케이프하여 유효한 JSON이 되도록 하세요.\n\n" +
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
      const binaryTypes = [
        'image/',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument',
        'application/vnd.ms-',
        'application/msword',
        'application/haansoft' // Support for Hancom Office formats
      ];

      const isBinary = binaryTypes.some(t => file.mimeType.startsWith(t));

      if (isBinary) {
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          
          // Map Haansoft/custom MIME types to standard ones if necessary
          let mimeType = file.mimeType;
          if (mimeType.includes('haansoftpptx') || mimeType.includes('pptx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (mimeType.includes('haansoftdocx') || mimeType.includes('docx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (mimeType.includes('haansofthwp')) {
            // HWP is tricky for Gemini, but let's send it as application/octet-stream 
            // Better to try converting or just keep as haansoft for now
          }

          parts.push({
            inlineData: { mimeType: mimeType, data: base64 }
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
    
    // Handle 429 Too Many Requests
    const isRateLimit = 
      error.message?.includes("429") || 
      error.message?.includes("quota") || 
      error.status === 429;

    if (isRateLimit) {
      return NextResponse.json({
        error: "인공지능 서버 할당량이 초과되었습니다. 잠시 후 다시 시도해 주세요. (무료 서버는 1분당 요청 횟수 및 토큰 수가 제한되어 있습니다.)",
        isRateLimit: true
      }, { status: 429 });
    }

    return NextResponse.json({
      error: error.message || "오류가 발생했습니다.",
      details: error.stack
    }, { status: 500 });
  }
}
