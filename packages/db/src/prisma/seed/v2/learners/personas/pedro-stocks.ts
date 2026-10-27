import { stockMarketCourse } from "../../library/stock-market/stock-market-course";
import { type SeedLearner } from "../types";

/** Learning how the stock market works to invest his first salary, with a one-hour daily limit. */
export const pedroStocks: SeedLearner = {
  attempts: [
    {
      answer: { selectedOptionId: "reinvested" },
      day: -5,
      isCorrect: true,
      key: "profit-reinvested",
      seconds: 26,
      skill: "share-ownership",
      step: { lesson: "own-a-share", position: 3 },
    },
    {
      answer: { selectedOptionId: "first" },
      day: -5,
      isCorrect: false,
      key: "bankruptcy-order",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: "Eles são pagos primeiro",
          correctAnswer: "Eles são os últimos da fila e muitas vezes não recebem nada",
          explanation:
            "Credores, trabalhadores e impostos vêm antes. Os acionistas são os últimos da fila.",
          format: "check",
          question: "A rede de padarias vai à falência. O que acontece com os acionistas?",
        },
        status: "open",
      },
      seconds: 31,
      skill: "shareholder-rights",
      step: { lesson: "own-a-share", position: 6 },
    },
  ],
  brainPower: 420,
  dailyLimitMinutes: 60,
  email: "v2-stocks@zoonk.test",
  goal: {
    course: stockMarketCourse,
    createdDay: -6,
    dailyMinutes: 15,
    details: { purpose: "overview", reason: "Quer aprender a investir o primeiro salário" },
    key: "stock-market",
    kind: "learn",
    plan: {
      items: [
        { day: -5, kind: "lesson", lesson: "own-a-share", phase: 0, status: "done" },
        { day: -3, kind: "lesson", lesson: "why-companies-sell", phase: 0, status: "done" },
        { day: -1, kind: "lesson", lesson: "dividends", phase: 0, status: "done" },
        { day: 0, kind: "lesson", lesson: "where-price-comes-from", phase: 1, status: "todo" },
        { day: 1, kind: "lesson", lesson: "brokers-exchanges", phase: 1, status: "todo" },
        { day: 3, kind: "lesson", lesson: "indexes", phase: 1, status: "todo" },
        { chapter: "why-prices-move", kind: "chapter", phase: 2, status: "todo" },
        { chapter: "long-run", kind: "chapter", phase: 3, status: "todo" },
      ],
      phases: [
        { name: "O que é uma ação" },
        { name: "Como funcionam as negociações" },
        { name: "Por que os preços se mexem" },
        { name: "Investir no longo prazo" },
      ],
    },
    prompt: "quero entender como funciona a bolsa de valores",
    studyTime: "16:00",
    title: "Entender a bolsa de valores",
  },
  history: { accuracy: 0.75, days: 6, energy: 40, minutesPerDay: 14, skipChance: 0.2 },
  key: "pedro",
  language: "pt",
  memory: [
    { category: "goals", origin: "said", statement: "Quer aprender a investir o primeiro salário" },
  ],
  milestones: [],
  name: "Pedro Lima",
  session: { finished: 1 },
  skills: [
    { memory: "solid", skill: "share-ownership" },
    { memory: "learning", skill: "shareholder-rights" },
    { memory: "learning", skill: "ipo" },
    { memory: "learning", skill: "dividends" },
  ],
  timeZone: "America/Sao_Paulo",
  username: "pedro_primeiro_salario",
};
