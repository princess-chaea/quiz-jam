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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const textPrompt = `당신은 대한민국 최고의 문항 출제 전문가입니다. 제공된 학습 자료의 핵심 교육 개념을 분석하여 ${count}개의 고품질 퀴즈 문항을 생성해주세요.

[핵심 출제 원칙]
- 유형 균형 및 섞기: 선택된 유형(${typeLabel})이 여러 개인 경우, 전체 문항 수(${count}) 내에서 각 유형이 최대한 골고루 섞이도록 **랜덤하게 순서를 배치(shuffle)**하세요. 특정 유형끼리 입구에 모여 있지 않도록 하세요.
- 개념 중심: 학습 자료에 나타난 주요 개념, 원리, 용어를 묻는 문제 위주로 구성하세요.
- 명확한 정답: 학생들의 다양한 생각을 수합할 수 없으므로, 주관적이거나 개방형인 질문은 지양하세요. 반드시 명확하게 하나의 단어로 정해지는 단답형 질문을 우선적으로 생성하세요.
- 복수 정답 및 동시 답변 지양: '~와 ~'처럼 두 가지 요소를 한꺼번에 묻는 방식은 순서 혼동이나 오답 처리가 잦으므로 피하세요. 만약 두 개의 핵심 개념을 모두 묻고 싶다면 반드시 'BLANK' 유형에서 각각의 빈칸을 구성하도록 하세요.
- 자연스러운 조사 사용: 한국어 조사(은/는, 이/가, 을/를)는 문맥상 가장 매끄럽고 올바르게 활용하세요. (예: '지층이 주어로 쓰일 때' 등)
- 문제 스타일 최적화: 단순 사칙연산은 지문 없이 계산식으로만, 사고력이 필요한 문제는 실생활 문장제 형식으로 출제하세요.
- 메타 질문 금지: 자료 자체에 대한 질문(차시, 제목, 목표 등)은 절대 금지합니다.
- 점수 및 시간 설정:
  - points: 문제의 난이도에 따라 10, 20, 30, 40, 50점 중 하나를 부여하세요.
  - timeLimit: 'SHORT_ANSWER'와 'BLANK'는 90초, 'OX'와 'MULTIPLE_CHOICE'는 30초로 설정하세요.

[퀴즈 유형별 규칙]
1. SHORT_ANSWER: 정답은 반드시 단어, 숫자, 또는 매우 짧은 핵심 구절이어야 합니다.
2. MATH: 모든 수식은 LaTeX 형식을 사용하세요.
3. MULTIPLE_CHOICE: 보기(options)는 4지선다형을 기본으로 합니다. 정답('a')은 반드시 보기 중 하나와 정확히 일치해야 합니다.
4. BLANK: 질문('q')에는 정답을 포함한 **완성된 전체 문장**을 넣으세요. 'BLANK', '( )', '____' 등의 표시를 **절대 사용하지 마세요.** 대신 'blanks' 배열에 해당 문장에서 빈칸으로 만들 단어의 인덱스(0부터 시작, 공백 기준 분리)를 넣으세요. **반드시 핵심 용어, 개념, 명사(코어 키워드)를 빈칸으로 만드세요.** 동사(예: '추리할', '하는')나 일반적인 서술어는 지양하세요. 정답 단어는 반드시 앞뒤로 띄어쓰기를 하여 정확히 분리되도록 하세요.

[수식 및 JSON 규칙]
- 분수는 \\frac{분자}{분모}, 곱하기는 \\times, 나누기는 \\div를 사용하세요.
- JSON 응답 시 백슬래시를 이스케이프하여 유효한 JSON이 되도록 하세요.

형식:
${formatPrompt}

학습 자료:
${text || "첨부 파일 참조"}`;

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
      supabase.storage.from('ai-temp').remove(tempFilePaths).catch((e: Error) => console.error("Cleanup error:", e));
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

    const isUnavailable =
      error.message?.includes("503") ||
      error.status === 503 ||
      error.message?.includes("overloaded");

    if (isRateLimit) {
      return NextResponse.json({
        error: "인공지능 서버 할당량이 초과되었습니다. 잠시 후 다시 시도해 주세요. (무료 서버는 1분당 요청 횟수 및 토큰 수가 제한되어 있습니다.)",
        isRateLimit: true
      }, { status: 429 });
    }

    if (isUnavailable) {
      return NextResponse.json({
        error: "인공지능 서버 사용량이 일시적으로 몰려 응답이 지연되고 있습니다. 약 10~20초 후 다시 시도해 주세요.",
        isUnavailable: true
      }, { status: 503 });
    }

    return NextResponse.json({
      error: error.message || "오류가 발생했습니다.",
      details: error.stack
    }, { status: 500 });
  }
}
