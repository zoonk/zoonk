import { type ExampleSet } from "../example-set";

const english = { id: "english", name: "英語", share: 0.44 };
const math = { id: "math", name: "数学", share: 0.38 };
const japanese = { id: "japanese", name: "国語", share: 0.35 };
const chemistry = { id: "chemistry", name: "化学", share: 0.31 };
const informatics = { id: "informatics", name: "情報", share: 0.4 };

const classical = { id: "classical", minutes: 5, subject: japanese, title: "古文：助動詞の意味" };

export const ja: ExampleSet = {
  exam: {
    date: "2027-01-16",
    goal: (month) => `${month}の共通テストに備える`,
    mock: {
      score: "62–70点",
      scoreOf: "数学Ⅰ・A",
      topics: [
        { id: "quadratic", name: "2次関数", right: 2, total: 4 },
        { id: "probability", name: "場合の数と確率", right: 3, total: 4 },
        { id: "trigonometry", name: "図形と計量", right: 3, total: 3 },
        { id: "data", name: "データの分析", right: 3, total: 3 },
      ],
    },
    name: "共通テスト",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "割合と百分率" },
        { id: "linear", state: "skipped", title: "1次関数" },
        { id: "quadratic", lessons: 6, state: "next", title: "2次関数" },
        { id: "probability", lessons: 8, state: "todo", title: "場合の数と確率" },
        { id: "trigonometry", lessons: 7, state: "todo", title: "図形と計量" },
      ],
      subject: math,
    },
    planName: (month) => `${month}の共通テスト`,
    practice: {
      answer:
        "2は、yが最小になるときのxの値です。聞かれているのはyの最小値なので、x = 2を代入します。y = 4 − 8 + 1 = −3です。平方完成して y = (x − 2)² − 3 としても、最小値が−3だとわかります。",
      ask: "どうして2ではないんですか？",
      explanation:
        "おしい！2は、yが最小になるときのxの値です。y = (x − 2)² − 3 と変形できるので、最小値は−3です。",
      options: [
        { text: "−4" },
        { result: "right", text: "−3" },
        { text: "1" },
        { result: "wrong", text: "2" },
      ],
      question: "2次関数 y = x² − 4x + 1 の最小値を求めよ。",
      subject: math,
    },
    subjects: [english, math, japanese, chemistry, informatics],
    today: [
      classical,
      { id: "quadratic", minutes: 6, subject: math, title: "2次関数の最大・最小" },
      { id: "reading", minutes: 7, subject: english, title: "長文の要旨をつかむ" },
    ],
    tomorrow: {
      lessons: [
        { id: "equilibrium", minutes: 5, subject: chemistry, title: "化学平衡" },
        { id: "probability", minutes: 6, subject: math, title: "場合の数と確率" },
      ],
      review: { ...classical, id: "review", minutes: 4, title: "復習：古文の助動詞" },
    },
  },
  job: {
    formulas: ["=SUM(B2:B9)", "=ADD(B2:B9)", "=SUM(B2,B9)"],
    regions: [
      { amount: 42_180, id: "kanto", name: "関東" },
      { amount: 37_920, id: "kansai", name: "関西" },
      { amount: 29_400, id: "chubu", name: "中部" },
    ],
    result: "うまくいきました。関東がいちばん売れています。",
    sql: { orders: "orders", region: "region", sales: "sales" },
  },
  move: "london",
};
