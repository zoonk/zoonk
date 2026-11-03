import { type ExampleSet } from "../example-set";

export const ko: ExampleSet = {
  career: {
    goal: "6개월 안에 데이터 분석가 되기",
    name: "6개월 안에 데이터 분석가 되기",
    skipped: "SQL 기초",
    topics: [
      { lessons: 6, title: "SQL JOIN" },
      { lessons: 8, title: "집계와 GROUP BY" },
      { lessons: 20, title: "데이터 분석을 위한 파이썬" },
      { lessons: 10, title: "Power BI 대시보드" },
      { lessons: 6, title: "포트폴리오와 기술 면접" },
    ],
  },
  exam: {
    day: [
      { detail: "자주 나오는 내용 복습", kind: "review", minutes: 6, title: "미분" },
      { detail: "영어", kind: "practice", minutes: 7, title: "빈칸 추론 문제" },
      { detail: "자주 나오는 내용 복습", kind: "review", minutes: 4, title: "근현대사" },
      { detail: "국어", kind: "lesson", minutes: 8, title: "현대시 감상" },
    ],
    goal: (month) => `${month} 수능 준비하기`,
    headline: "수능 준비",
    mock: {
      details: "30문항 · 100분",
      firm: ["지수와 로그", "적분"],
      mistakes: 3,
      name: "수학",
      review: ["미분", "수열"],
      scores: [{ label: "수학", range: "2–3등급" }],
    },
    name: "수능",
    sittings: ["2026-11-19", "2027-11-18"],
    timeZone: "Asia/Seoul",
  },
  exams: "수능, 공무원 시험, 자격증, 토익",
  move: "london",
  topic: {
    chapters: [
      "고전 물리학으로는 왜 부족했을까",
      "빛은 파동일까, 입자일까",
      "보어의 원자 모형",
      "불확정성 원리",
      "양자 얽힘",
    ],
    laterChapters: 7,
    name: "처음부터 배우는 양자역학",
    subjects: "양자역학, 미술사, 주식 시장이 움직이는 원리",
  },
};
