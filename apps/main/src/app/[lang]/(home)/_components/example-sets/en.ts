import { type ExampleSet } from "../example-set";

const reading = { id: "reading", name: "Reading and Writing", share: 0.38 };
const math = { id: "math", name: "Math", share: 0.3 };

const wordsInContext = { id: "words", minutes: 5, subject: reading, title: "Words in context" };

export const en: ExampleSet = {
  exam: {
    date: "2027-03-06",
    goal: (month) => `get ready for the SAT in ${month}`,
    mock: {
      score: "1180–1260",
      scoreOf: "SAT",
      topics: [
        { id: "linear", name: "Linear equations", right: 3, total: 4 },
        { id: "percentages", name: "Percentages", right: 3, total: 4 },
        { id: "words", name: "Words in context", right: 3, total: 4 },
        { id: "transitions", name: "Transitions", right: 3, total: 3 },
      ],
    },
    name: "SAT",
    placed: {
      rows: [
        { id: "percentages", state: "skipped", title: "Percentages" },
        { id: "ratios", state: "skipped", title: "Ratios and rates" },
        { id: "linear", lessons: 6, state: "next", title: "Linear equations" },
        { id: "systems", lessons: 8, state: "todo", title: "Systems of equations" },
        { id: "quadratics", lessons: 7, state: "todo", title: "Quadratics" },
      ],
      subject: math,
    },
    planName: (month) => `SAT in ${month}`,
    practice: {
      answer:
        "308 is what you get if you divide all of the $15.40 by 5 cents. But $12 of it is the monthly fee. Only the $3.40 left pays for texts, and $3.40 ÷ $0.05 = 68.",
      ask: "Why isn't it 308?",
      explanation:
        "Not quite. $12 of it is the monthly fee: only $3.40 pays for texts, and $3.40 ÷ $0.05 = 68.",
      options: [
        { text: "58" },
        { result: "right", text: "68" },
        { text: "72" },
        { result: "wrong", text: "308" },
      ],
      question:
        "A phone plan costs $12 a month plus $0.05 per text. Ana paid $15.40 in March. How many texts did she send?",
      subject: math,
    },
    subjects: [reading, math],
    today: [
      wordsInContext,
      { id: "equations", minutes: 6, subject: math, title: "Linear equations in context" },
      { id: "transitions", minutes: 7, subject: reading, title: "Transitions" },
    ],
    tomorrow: {
      lessons: [
        { id: "synthesis", minutes: 7, subject: reading, title: "Rhetorical synthesis" },
        { id: "slope", minutes: 6, subject: math, title: "Slope and intercept" },
      ],
      review: { ...wordsInContext, id: "review", minutes: 6, title: "Review: words in context" },
    },
  },
  job: {
    formulas: ["=SUM(B2:B9)", "=ADD(B2:B9)", "=SUM(B2,B9)"],
    regions: [
      { amount: 42_180, id: "north", name: "North" },
      { amount: 37_920, id: "south", name: "South" },
      { amount: 29_400, id: "west", name: "West" },
    ],
    result: "It works. North sold the most.",
    sql: { orders: "orders", region: "region", sales: "sales" },
  },
  move: "mexico-city",
};
