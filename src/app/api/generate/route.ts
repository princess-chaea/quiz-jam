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
1. SHORT_ANSWER: 질문('q')은 자연스럽고 명확한 의문문 형식(~은 무엇입니까?, ~라고 합니까?)으로 작성하세요. 정답은 반드시 단어, 숫자, 또는 매우 짧은 핵심 구절이어야 합니다. 질문 문장에 조사 분리를 위한 인위적인 띄어쓰기(예: "빛 이")를 절대 하지 마세요.
2. MATH: 모든 수식은 LaTeX 형식을 사용하세요.
3. MULTIPLE_CHOICE: 보기(options)는 4지선다형을 기본으로 합니다. 정답('a')은 반드시 보기 중 하나와 정확히 일치해야 합니다.
4. OX: 질문('q')은 사실 여부를 판별할 수 있는 평서문으로 작성하세요. 정답('a')은 반드시 대문자 알파벳 "O" 또는 "X" 중 하나만 적으세요 (절대 1, 2, 맞다, 틀리다 등을 사용하지 마세요). type은 반드시 "OX"여야 하며 MULTIPLE_CHOICE로 착각하여 출력하지 마세요.
5. BLANK: 
  **[출제 기준 - 반드시 지킬 것]** 
  - 질문('q')에는 정답을 포함한 **완성된 전체 문장**을 적으세요. 단, 빈칸으로 뚫고 싶은 핵심 단어는 반드시 **{{단어}}** 형식으로 중괄호 두 개로 감싸서 표시해야 합니다.
  - **띄어쓰기 및 조사 분리 규칙 (반드시 준수):** 한국어 문장에서 정답 단어에 조사가 붙어 있다면(예: '지구가', '지형은'), 반드시 **정답 단어와 조사를 공백으로 분리**하고 단어에만 괄호를 씌우세요 (예: '{{지구}} 가', '{{지형}} 은'). 
  - **정답('a')**은 반드시 조사를 제외한 **순수한 핵심 단어**만 기술하세요. 복수 빈칸인 경우 콤마(,)로 구분하세요.
  - **성공 예시:** q: "오랜 시간 쌓인 {{지층}} 은 여러 겹으로 보입니다.", a: "지층"
  - **성공 예시:** q: "{{지구}} 가 {{자전}} 을 하여 낮과 밤이 생깁니다.", a: "지구, 자전"

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

      if (isBinary) {
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
      supabase.storage.from('ai-temp').remove(tempFilePaths).catch((e: Error) => console.error("Cleanup error:", e));
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Post-process the generated questions to ensure robust formatting
    const processedQuestions = questions.map((q: any) => {
      // 1. BLANK: Parse {{ }} out of the question and map to blanks array
      if (q.type === 'BLANK' && q.q) {
        if (q.q.includes('{{') && q.q.includes('}}')) {
          const words = q.q.split(/\s+/);
          const newBlanks: number[] = [];
          const cleanWords = words.map((w: string, idx: number) => {
            if (w.includes('{{') && w.includes('}}')) {
              newBlanks.push(idx);
              return w.replace(/[{}]/g, '');
            }
            return w;
          });
          q.q = cleanWords.join(' ');
          // Always trust our parsed indices if we found brackets
          if (newBlanks.length > 0) {
            q.blanks = newBlanks;
          }
        }
        // Fallback: if AI provides blanks but no brackets, we accept it as is
      }
      
      // 2. OX: Enforce correct format
      if (q.type === 'OX') {
        q.options = ["O", "X"]; // OX type UI does not need options, but ensure consistency
        if (typeof q.a === 'boolean') {
          q.a = q.a ? "O" : "X";
        } else if (typeof q.a === 'string') {
          const upperA = q.a.toUpperCase().trim();
          if (["1", "TRUE", "맞다", "O", "ㅇ"].includes(upperA)) q.a = "O";
          else if (["2", "FALSE", "틀리다", "X", "ㄴ"].includes(upperA)) q.a = "X";
          else q.a = upperA;
        }
      }

      // Fix AI mistakenly outputting MULTIPLE_CHOICE for OX
      if (q.type === 'MULTIPLE_CHOICE' && q.options && q.options.length === 2) {
        const isOX = q.options.every((opt: string) => ["O", "X", "맞다", "틀리다", "True", "False"].includes(opt));
        if (isOX) {
          q.type = 'OX';
          q.options = ["O", "X"];
          q.a = q.a === q.options[0] || q.a === "O" || q.a === "맞다" || q.a === "True" ? "O" : "X";
        }
      }

      return q;
    });

    return NextResponse.json(processedQuestions);

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
