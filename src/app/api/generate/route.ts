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
      storageFiles = [], // New field for files uploaded to Supabase Storage
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

    const formatPrompt = `
      [
        {
          "q": "질문 내용 (빈칸 문제의 경우, 정답 단어 앞뒤에 반드시 공백을 한 칸씩 두어 문장 그대로 작성하세요. 예: '대한민국의 수도는 서울 입니다.')",
          "options": ["보기1", "보기2", "보기3", "보기4"], // '선다형'일 경우 필수 (2~4개). 그 외 생략
          "a": "정답", // '선다형'은 options 중 하나와 일치, 'OX'는 "O" 또는 "X", '단답형'/'빈칸넣기'는 정답 단어
          "type": "MULTIPLE_CHOICE, SHORT_ANSWER, OX, 또는 BLANK",
          "blanks": [index1, index2], // '빈칸넣기'일 경우 필수. q를 공백으로 나눴을 때 정답이 될 단어의 인덱스 배열 (0부터 시작)
          "points": 10,
          "math_mode": false, // 해당 문항에 실제 수식이 포함된 경우만 true로 설정
          "template": "\\\\frac{\\\\square}{\\\\square}" // 'math_mode'가 true인 경우 필수. 학생이 입력할 양식 (숫자가 들어갈 자리에 \\\\square 사용)
        }
      ]
    `;

    const textPrompt = `
      당신은 대한민국 최고의 문항 출제 전문가이자 친절한 선생님입니다.
      제공된 학습 자료(텍스트 또는 파일)를 깊이 있게 분석하여, 학생들이 반드시 익혀야 할 핵심 개념을 관통하는 고품질의 퀴즈 문항 ${count}개를 생성해주세요.

      [핵심 출제 원칙]
      - **전문성**: 단순한 사실 확인을 넘어 사고력을 요하는 문항을 구성하세요.
      - **일관성**: 요청된 유형(${typeLabel})에 충실하며, 질문 내용에 맞춰 수식 입력을 위한 "math_mode"를 개별적으로 설정하세요.
      - **[중요] 수식 모드(math_mode) 결정**: 
        - 사용자가 전체적으로 수식 모드(${mathMode})를 요청했더라도, **개별 문항의 정답이 분수, 루트, 지수 등 복잡한 수식 입력을 필요로 하는 경우에만 "math_mode": true**로 설정하세요.
        - 단순 텍스트나 숫자만 입력하는 문항은 반드시 "math_mode": false로 설정하여 일반 키보드가 뜨게 하세요.
      - **수준**: 초등학생부터 고등학생까지 풀 수 있도록 문항의 난이도를 자료의 수준에 맞춰 적절히 조절하세요.

      [퀴즈 유형별 생성 규칙]
      1. MATH (수학/수식): 수학적 개념, 공식, 계산이 포함된 문항입니다.
         - 실제 수식 입력이 필요한 경우만 "math_mode": true 로 설정하세요.
         - 모든 수학적 기호와 식은 LaTeX 형식을 사용하되, 앞뒤 달러 기호($) 없이 작성하세요. (예: \\\\frac{1}{2}, \\\\sqrt{2}, x^{2} + y^{2} = r^{2})
         - 학생이 숫자를 채워 넣을 수 있도록 "template" 필드에 완성된 양식을 제공하세요. (숫자 자리에 \\\\square 사용)
      2. MULTIPLE_CHOICE (선다형): "math_mode"가 true인 경우 보기(options)에도 LaTeX를 적극 활용하세요.
      3. SHORT_ANSWER (단답형): 정답이 숫자나 기호인 경우입니다.
      4. BLANK (빈칸 넣기): 문장의 핵심 키워드를 공백으로 만듭니다.
      5. OX (O/X 퀴즈): 자료의 핵심 내용을 참/거짓으로 묻습니다.

      [수학 수식 작성 및 JSON 탈출(Escape) 규칙]
      - 모든 수학 기호(사칙연산 포함)는 LaTeX를 권장합니다. (예: \\\\times, \\\\div, \\\\pm, \\\\approx)
      - **[중요] 분수 작성**: 반드시 \\\\frac{분자}{분모} 형식을 사용하고, 분자와 분모를 반드시 중괄호 {}로 감싸세요. (예: \\\\frac{1}{2}, \\\\frac{x}{y})
      - **[절대 금지]**: 수학적 맥락에서 `/` 기호를 사용하여 분수를 표현하지 마세요. (예: 1/2 (X) -> \\\\frac{1}{2} (O))
      - **JSON 출력 시 백슬래시(\\\\)는 반드시 '\\\\\\\\'로 네 번(4번) 이스케이프 처리하여, 클라이언트에서 '\\\\'로 인식될 수 있게 하세요.** (매우 중요: \\\\frac -> \\\\\\\\frac)

      [빈칸 넣기(BLANK) 문항 생성 규칙]:
      1. 'q' 필드에는 빈칸이 포함된 전체 문장을 작성하세요.
      2. 정답이 될 단어 앞뒤에는 반드시 공백을 한 칸씩 넣어주세요. (예: "대한민국의 수도는 서울 입니다.")
      3. 'blanks' 필드에는 'q'를 공백으로 split 했을 때의 인덱스 배열(0부터 시작)을 넣으세요.

      형식:
      ${formatPrompt}

      학습 자료:
      ${text || "첨부 파일 참조"}
    `;

    const parts: any[] = [{ text: textPrompt }];

    // Handle legacy base64 files (if any)
    for (const file of filesData) {
      parts.push({
        inlineData: { mimeType: file.mimeType, data: file.data }
      });
    }

    // Handle large files from Supabase Storage
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
      
      // Determine if it's media (Gemini inlineData) or text
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
        // For text-based files, read content and append to prompt
        try {
          const textContent = await fileData.text();
          extractedText += `\n\n[File: ${file.name}]\n${textContent}`;
        } catch (err) {
          console.error(`Text extraction error for ${file.path}:`, err);
        }
      }
    }

    if (extractedText) {
      parts[0].text += `\n\n추가 학습 자료 (파일 내용):${extractedText}`;
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("AI Response:", responseText); // Log full response for debugging
      throw new Error("AI가 유효한 JSON 형식을 생성하지 못했습니다. (응답 형식이 올바르지 않음)");
    }

    // Attempt to cleanup temporary files from storage asynchronously
    if (tempFilePaths.length > 0) {
      supabase.storage.from('ai-temp').remove(tempFilePaths).catch(e => console.error("Cleanup error:", e));
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(questions);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Provide more helpful error messages for 400 cases if possible
    const status = error.message?.includes('400') || error.message?.includes('invalid') ? 400 : 500;
    return NextResponse.json({ 
      error: error.message || "알 수 없는 오류가 발생했습니다.",
      details: error.stack
    }, { status });
  }
}
