import { t } from "../../_utils/localize";
import { stockMarketCourse } from "../../library/stock-market/stock-market-course";
import { shareholderVoteItem } from "../../library/stock-market/stock-market-items";
import { type SeedLearner } from "../types";

const { content: shareholderVote } = shareholderVoteItem;
const [correctVote, missedVote] = shareholderVote.options;

export const pedroStocks: SeedLearner = {
  attempts: [
    {
      answer: { selectedOptionId: "reinvested" },
      day: -5,
      isCorrect: true,
      key: "profit-reinvested",
      seconds: 26,
      skill: "share-ownership",
      step: { lesson: "own-a-share", position: 4 },
    },
    {
      answer: { selectedOptionId: "first" },
      day: -5,
      isCorrect: false,
      key: "bankruptcy-order",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: t("They're paid back first", "Eles são pagos primeiro"),
          correctAnswer: t(
            "They're last in line and often get nothing",
            "Eles são os últimos da fila e muitas vezes não recebem nada",
          ),
          explanation: t(
            "Lenders, workers and taxes come first. Shareholders are last in line.",
            "Credores, trabalhadores e impostos vêm antes. Os acionistas são os últimos da fila.",
          ),
          format: "check",
          question: t(
            "The bakery chain goes bankrupt. What happens to its shareholders?",
            "A rede de padarias vai à falência. O que acontece com os acionistas?",
          ),
        },
        status: "open",
      },
      seconds: 31,
      skill: "shareholder-rights",
      step: { lesson: "own-a-share", position: 7 },
    },
    {
      answer: { selectedIndex: 1 },
      day: -3,
      isCorrect: false,
      item: shareholderVoteItem.key,
      key: shareholderVoteItem.key,
      mistake: {
        cause: "gap",
        snapshot: {
          answer: missedVote.text,
          context: shareholderVote.context,
          correctAnswer: correctVote.text,
          explanation: missedVote.reason,
          format: shareholderVoteItem.format,
          misconception: missedVote.misconception,
          question: shareholderVote.question,
        },
        status: "open",
      },
      seconds: 22,
      skill: shareholderVoteItem.skill,
    },
    {
      answer: { number: 0.05, values: { owned: 5000, total: 10_000_000 } },
      day: -3,
      isCorrect: true,
      item: "ownership-percent",
      key: "ownership-percent",
      seconds: 48,
      skill: "share-ownership",
    },
    {
      answer: { isTrue: true },
      day: -1,
      isCorrect: false,
      item: "no-guaranteed-return",
      key: "no-guaranteed-return",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: "true",
          correctAnswer: "false",
          explanation: t(
            "Nobody promises shareholders a return. Dividends and gains depend on how the company does.",
            "Ninguém promete retorno aos acionistas. Dividendos e ganhos dependem de como a empresa vai.",
          ),
          format: "trueFalse",
          misconception: t(
            "Thinks shares come with a promised return",
            "Acha que ações vêm com retorno prometido",
          ),
          question: t(
            "A company must pay its shareholders a minimum return every year.",
            "Uma empresa é obrigada a pagar um retorno mínimo aos acionistas todo ano.",
          ),
        },
        status: "open",
      },
      seconds: 14,
      skill: "shareholder-rights",
    },
  ],
  brainPower: 420,
  email: "v2-stocks@zoonk.test",
  goal: {
    course: stockMarketCourse,
    createdDay: -6,
    dailyMinutes: 15,
    details: {
      answered: ["purpose", "targetDate", "level", "buddy", "placement", "schedule"],
      purpose: "overview",
      reason: "Quer aprender a investir o primeiro salário",
    },
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
        { name: t("What a share is", "O que é uma ação") },
        { name: t("How trading works", "Como funcionam as negociações") },
        { name: t("Why prices move", "Por que os preços se mexem") },
        { name: t("Investing for the long run", "Investir no longo prazo") },
      ],
    },
    prompt: "quero entender como funciona a bolsa de valores",
    studyTime: "16:00",
    title: t("Understand the stock market", "Entender a bolsa de valores"),
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
    { memory: "fading", skill: "share-ownership" },
    { memory: "learning", skill: "shareholder-rights" },
    { memory: "learning", skill: "ipo" },
    { memory: "learning", skill: "dividends" },
  ],
  timeZone: "America/Sao_Paulo",
  username: "pedro_primeiro_salario",
};
