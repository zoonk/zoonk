import { type ExampleSet } from "../example-set";

export const ja: ExampleSet = {
  career: {
    goal: "半年でデータアナリストになる",
    name: "半年でデータアナリストに",
    skipped: "SQLの基礎",
    topics: [
      { lessons: 6, title: "SQLのJOIN" },
      { lessons: 8, title: "集計とGROUP BY" },
      { lessons: 20, title: "データ分析のためのPython" },
      { lessons: 10, title: "Power BIでダッシュボード作成" },
      { lessons: 6, title: "ポートフォリオと技術面接" },
    ],
  },
  exam: {
    day: [
      { detail: "復習", kind: "review", minutes: 6, title: "2次関数" },
      { detail: "英語", kind: "practice", minutes: 7, title: "リーディングの演習" },
      { detail: "国語", kind: "lesson", minutes: 8, title: "古文の助動詞" },
      { detail: "復習", kind: "review", minutes: 4, title: "化学平衡" },
    ],
    goal: (month) => `${month}の共通テストに備える`,
    headline: "共通テスト対策",
    mock: {
      details: "70分",
      firm: ["図形と計量", "データの分析"],
      mistakes: 3,
      name: "数学Ⅰ・A",
      review: ["2次関数", "場合の数と確率"],
      scores: [{ label: "数学Ⅰ・A", range: "62–70点" }],
    },
    name: "共通テスト",
    sittings: ["2027-01-16"],
    timeZone: "Asia/Tokyo",
  },
  exams: "共通テスト、大学の個別試験、資格試験、TOEIC",
  move: "london",
  topic: {
    chapters: [
      "古典物理学では説明できなかったこと",
      "光は波か、粒子か",
      "ボーアの原子模型",
      "不確定性原理",
      "量子もつれ",
    ],
    laterChapters: 7,
    name: "ゼロから学ぶ量子力学",
    subjects: "量子力学、美術史、株式市場のしくみ",
  },
};
