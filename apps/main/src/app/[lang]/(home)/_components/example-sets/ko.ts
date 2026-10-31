import { type ExampleSet } from "../example-set";

const korean = { id: "korean", name: "국어", share: 0.36 };
const math = { id: "math", name: "수학", share: 0.41 };
const english = { id: "english", name: "영어", share: 0.47 };
const history = { id: "history", name: "한국사", share: 0.52 };
const inquiry = { id: "inquiry", name: "탐구", share: 0.31 };

const poetry = { id: "poetry", minutes: 5, subject: korean, title: "현대시: 화자와 태도" };

export const ko: ExampleSet = {
  exam: {
    goal: (month) => `${month} 수능 준비하기`,
    mock: {
      score: "2–3등급",
      scoreOf: "수학",
      topics: [
        { id: "derivatives", name: "미분", right: 2, total: 4 },
        { id: "sequences", name: "수열", right: 3, total: 4 },
        { id: "logs", name: "지수와 로그", right: 3, total: 3 },
        { id: "integrals", name: "적분", right: 3, total: 3 },
      ],
    },
    name: "수능",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "비와 백분율" },
        { id: "linear", state: "skipped", title: "일차함수" },
        { id: "logs", lessons: 6, state: "next", title: "지수와 로그" },
        { id: "sequences", lessons: 8, state: "todo", title: "수열" },
        { id: "derivatives", lessons: 7, state: "todo", title: "미분" },
      ],
      subject: math,
    },
    planName: (month) => `${month} 수능`,
    practice: {
      answer:
        "2는 x = 0일 때의 값, 즉 극댓값이에요. f′(x) = 3x(x − 2)의 부호가 x = 2에서 음에서 양으로 바뀌니까 극소는 x = 2에서 생겨요. 그래서 극솟값은 f(2) = 8 − 12 + 2 = −2예요.",
      ask: "왜 2가 아니에요?",
      explanation:
        "아쉬워요. 2는 x = 0일 때의 극댓값이에요. f′(x) = 3x(x − 2)이므로 x = 2에서 극소이고, 극솟값은 f(2) = −2예요.",
      options: [
        { text: "−4" },
        { result: "right", text: "−2" },
        { text: "0" },
        { result: "wrong", text: "2" },
        { text: "4" },
      ],
      question: "함수 f(x) = x³ − 3x² + 2의 극솟값은?",
      subject: math,
    },
    sittings: ["2026-11-19", "2027-11-18"],
    subjects: [korean, math, english, history, inquiry],
    timeZone: "Asia/Seoul",
    today: [
      poetry,
      { id: "sequences", minutes: 6, subject: math, title: "수열의 합" },
      { id: "blank", minutes: 7, subject: english, title: "빈칸 추론" },
    ],
    tomorrow: {
      lessons: [
        { id: "ethics", minutes: 5, subject: inquiry, title: "생활과 윤리: 사회 정의" },
        { id: "limits", minutes: 6, subject: math, title: "함수의 극한" },
      ],
      review: { ...poetry, id: "review", minutes: 4, title: "복습: 현대시의 화자" },
    },
  },
  job: {
    formulas: ["=SUM(B2:B9)", "=ADD(B2:B9)", "=SUM(B2,B9)"],
    regions: [
      { amount: 42_180, id: "capital", name: "수도권" },
      { amount: 37_920, id: "yeongnam", name: "영남" },
      { amount: 29_400, id: "honam", name: "호남" },
    ],
    result: "성공했어요. 수도권 매출이 가장 많아요.",
    sql: { orders: "orders", region: "region", sales: "sales" },
  },
  move: "london",
};
