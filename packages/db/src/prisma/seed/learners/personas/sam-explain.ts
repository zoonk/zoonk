import { stockMarketCourse } from "../../library/stock-market/stock-market-course";
import { type SeedLearner } from "../types";

export const samExplain: SeedLearner = {
  attempts: [
    {
      answer: { selectedOptionId: "basket" },
      day: 0,
      inSession: true,
      isCorrect: true,
      key: "headline-check",
      seconds: 19,
      skill: "read-market-headline",
      step: { lesson: "market-up-two-percent", position: 5 },
    },
  ],
  brainPower: 60,
  email: "v2-explain@zoonk.test",
  goal: {
    course: stockMarketCourse,
    createdDay: 0,
    dailyMinutes: 5,
    details: { question: "what does it mean when the market is up 2%?" },
    key: "market-up",
    kind: "explain",
    plan: {
      items: [
        { day: 0, kind: "lesson", lesson: "market-up-two-percent", phase: 0, status: "todo" },
      ],
      phases: [{ name: "Quick explanation" }],
    },
    prompt: "what does it mean when the market is up 2%?",
    studyTime: "12:30",
    title: "What does “the market is up 2%” mean?",
  },
  history: { accuracy: 1, days: 0, energy: 12, minutesPerDay: 4, skipChance: 0 },
  key: "sam",
  language: "en",
  memory: [
    {
      category: "context",
      origin: "said",
      statement: "Just started investing through an index fund",
    },
  ],
  milestones: [],
  name: "Sam Rivera",
  session: { finished: 1 },
  skills: [{ memory: "learning", skill: "read-market-headline" }],
  timeZone: "America/Chicago",
  username: "sam_asks",
};
