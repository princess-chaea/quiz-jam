import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, count = 5, types = ["SHORT_ANSWER"], filesData = [] } = await req.json();

    if (!text && filesData.length === 0) {
      return NextResponse.json({ error: "텍스트나 파일이 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "Gemini API Key가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 추가해주세요."
      }, { status: 500 });
    }

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
          "math_mode": false // 수학 수식이 포함되어 수식 전용 에디터(MathLive)가 필요한지 여부 (true/false)
        }
      ]
    `;

    const textPrompt = `
      제공된 텍스트나 첨부된 파일을 바탕으로 초등학생들이 즐겁게 풀 수 있는 ${typeLabel} 퀴즈 문항 총 ${count}개를 생성해주세요.
      출력 형식은 반드시 아래의 JSON 배열 형식이어야 합니다. 다른 말은 덧붙이지 마세요.
      
      [퀴즈 유형별 생성 규칙]
      1. MATH (수학/수식): 수학 문제이거나 수식, 분수, 기호가 포함된 경우입니다. 반드시 "math_mode": true 로 설정하고, 모든 수학적 표현은 LaTeX 형식을 사용하되 앞뒤 달러 기호($) 없이 작성하세요. (예: \\frac{1}{2}, 2^{3})
      2. MULTIPLE_CHOICE (선다형): "math_mode"가 true인 경우 options에도 LaTeX를 사용할 수 있습니다.
      3. SHORT_ANSWER (단답형): 정답이 숫자인 경우에도 수식 기호가 필요하면 MATH 유형으로 생성하세요.
      4. BLANK (빈칸 넣기): 문장 속의 핵심 단어를 빈칸으로 만듭니다.
      5. OX (O/X 퀴즈): 참/거짓을 판별하는 문제입니다.

      [수학 수식 작성 공통 규칙]
      - 모든 수학 기호(사칙연산 포함)는 LaTeX를 권장합니다. (예: \\times, \\div)
      - JSON 출력 시 백슬래시(\\)는 반드시 '\\\\'로 이스케이프 처리하세요.

      [빈칸 넣기(BLANK) 문항 생성 규칙]:
      1. 'q' 필드에는 빈칸이 포함된 전체 문장을 작성하세요.
      2. 정답이 될 단어 앞뒤에는 반드시 공백을 한 칸씩 넣어주세요.
      3. 'blanks' 필드에는 'q'를 공백으로 split 했을 때의 인덱스 배열을 넣으세요.

      형식:
      ${formatPrompt}

      텍스트:
      ${text || "첨부 파일 참조"}
    `;

    const parts: any[] = [{ text: textPrompt }];

    // Add all uploaded files as parts
    for (const file of filesData) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    }

    const result = await model.generateContent(parts);

    const response = await result.response;
    const responseText = response.text();

    // Extract JSON from response (Gemini sometimes adds markdown blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI가 유효한 JSON 형식을 생성하지 못했습니다.");
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(questions);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
