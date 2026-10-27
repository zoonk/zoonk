import { localDay } from "../../_utils/dates";
import { t } from "../../_utils/localize";
import { enemCourse } from "../../library/enem/enem-course";
import { type EnemEdition } from "../../library/enem/enem-edition";
import { type SeedAttempt, type SeedGoal, type SeedLearner } from "../types";
import { anaGraph } from "./ana-graph";

const TIME_ZONE = "America/Sao_Paulo";
const DAYS_PER_WEEK = 7;
/**
 * Her first mock, untitled as the planner's mocks are: apps name them by number, and core plans
 * its questions from the bank as the session builder plans the week's mock.
 */
const FIRST_MOCK = "";

/**
 * Days back to the last Sunday, when she took her first mock; never today, so on a Sunday it's the
 * one a week ago. Her plan began two weeks ago, so it's the planner's first mock day (the week's
 * event day from the plan's second week), and the next ones come every few weeks at her 45 minutes
 * a day, as the planner lays them out.
 */
function lastSunday(now: Date): number {
  return -(localDay(now, TIME_ZONE).getUTCDay() || DAYS_PER_WEEK);
}

/**
 * The exam's four windows (foundations, gaps, practice and the final stretch), which the planner
 * dates back from the exam day and apps name by kind.
 */
const EXAM_PHASES = [{ name: "" }, { name: "" }, { name: "" }, { name: "" }];

const anaAttempts: SeedAttempt[] = [
  {
    answer: { dontKnow: true },
    day: -14,
    isCorrect: false,
    item: "energy-loss-reason",
    key: "diagnostic-energy",
    seconds: 40,
    skill: "energy-flow",
  },
  {
    answer: { selectedIndex: 1 },
    day: -14,
    isCorrect: true,
    item: "clt-era",
    key: "diagnostic-clt",
    seconds: 35,
    skill: "vargas-era",
  },
  {
    answer: { selectedIndex: 0 },
    day: -14,
    isCorrect: true,
    item: "beach-sign",
    key: "diagnostic-sign",
    seconds: 28,
    skill: "inference",
  },
  {
    answer: { selectedIndex: 3 },
    day: -14,
    isCorrect: false,
    item: "flashlight-current",
    key: "diagnostic-circuit",
    seconds: 70,
    skill: "series-resistors",
  },
  {
    answer: { number: 18, values: { price: 120, rate: 15 } },
    day: -6,
    isCorrect: false,
    item: "discount-shirt",
    key: "shirt-discount",
    mistake: {
      cause: "misread",
      snapshot: {
        answer: "R$ 18",
        correctAnswer: "R$ 102",
        explanation: "Isso é o que você economiza. Você paga o que sobra depois dele.",
        format: "numeric",
        misconception: "Respondeu com o desconto em vez do preço pago",
        question: "Uma camisa de R$ 120 está com 15% de desconto. Quanto você paga, em reais?",
      },
      status: "open",
    },
    seconds: 52,
    skill: "percent-discount",
  },
  {
    answer: { selectedIndex: 0 },
    day: -4,
    isCorrect: false,
    item: "fund-gain-loss",
    key: "fund-trap",
    mistake: {
      cause: "trap",
      snapshot: {
        answer: "R$ 1.000",
        correctAnswer: "R$ 990",
        explanation: "A perda de 10% saiu de R$ 1.100, então tirou R$ 110.",
        format: "multipleChoice",
        misconception: "Achou que ganho e perda iguais se anulam",
        question:
          "Um investidor aplicou R$ 1.000. No primeiro mês rendeu 10%; no segundo, perdeu 10%. Ao fim dos dois meses, ele tem:",
      },
      status: "open",
    },
    seconds: 64,
    skill: "successive-percent",
  },
  {
    answer: { number: 5000, values: { energy: 50_000 } },
    day: -3,
    isCorrect: false,
    item: "energy-two-levels",
    key: "energy-one-level",
    mistake: {
      cause: "gap",
      snapshot: {
        answer: "5.000 kcal",
        correctAnswer: "500 kcal",
        explanation:
          "Os consumidores secundários estão dois níveis acima dos produtores, então multiplique por 0,1 duas vezes.",
        format: "numeric",
        misconception: "Subiu só um nível",
        question:
          "Os produtores de um ecossistema captam 50000 kcal. Em média, quanto chega aos consumidores secundários?",
      },
      status: "fixed",
    },
    seconds: 58,
    skill: "ten-percent-rule",
  },
  {
    answer: { number: 500, values: { energy: 50_000 } },
    day: -1,
    isCorrect: true,
    item: "energy-two-levels",
    key: "energy-two-levels-again",
    seconds: 40,
    skill: "ten-percent-rule",
  },
  {
    answer: { selectedIndex: 3 },
    day: -2,
    isCorrect: false,
    item: "flashlight-current",
    key: "circuit-one-resistor",
    mistake: {
      cause: "gap",
      snapshot: {
        answer: "3,0 A",
        correctAnswer: "1,0 A",
        explanation: "6 ÷ 2 usa só um resistor. Em série eles se somam.",
        format: "multipleChoice",
        misconception: "Usou só o resistor de 2 Ω",
        question:
          "Uma lanterna usa uma bateria de 6 V ligada a dois resistores em série, de 2 Ω e 4 Ω. Qual é a corrente elétrica no circuito?",
      },
      status: "open",
    },
    seconds: 95,
    skill: "series-resistors",
  },
  // Answers inside the lessons she finished: what shows preparation, since one right answer in a
  // test only frees a topic from its lessons until practice confirms it.
  ...(
    [
      [-13, "percent-basics"],
      [-12, "main-idea"],
      [-11, "energy-flow"],
      [-8, "rule-of-three"],
    ] as const
  ).map(([day, skill]): SeedAttempt => ({
    answer: { selectedIndex: 0 },
    day,
    isCorrect: true,
    key: `lesson-${skill}`,
    seconds: 25,
    skill,
  })),
];

const anaProfile: Omit<SeedLearner, "goal"> = {
  attempts: anaAttempts,
  brainPower: 4340,
  email: "v2-exam@zoonk.test",
  history: { accuracy: 0.72, days: 14, energy: 72, minutesPerDay: 45, skipChance: 0.1 },
  key: "ana",
  language: "pt",
  memory: [
    { category: "goals", origin: "said", statement: "Quer cursar Medicina na UFMG" },
    { category: "routine", origin: "said", statement: "Estuda à noite, depois da escola" },
    { category: "routine", origin: "said", statement: "Faz cursinho aos sábados de manhã" },
    {
      category: "learning",
      origin: "noticed",
      statement: "Vai melhor em Ciências Humanas do que em Ciências da Natureza",
    },
  ],
  milestones: [{ day: -3, key: "yellow", kind: "belt", shown: true }],
  name: "Ana Souza",
  plus: true,
  session: { finished: 1, started: true },
  skills: [
    { memory: "solid", skill: "percent-basics" },
    { memory: "solid", skill: "rule-of-three" },
    { memory: "mastered", skill: "main-idea" },
    { memory: "solid", skill: "inference" },
    { memory: "solid", skill: "coffee-with-milk" },
    { memory: "learning", skill: "vargas-era" },
    { memory: "fading", skill: "energy-flow" },
    { memory: "learning", skill: "ten-percent-rule" },
    { memory: "learning", skill: "series-resistors" },
    { memory: "learning", skill: "successive-percent" },
  ],
  timeZone: TIME_ZONE,
  username: "ana_enem",
};

/** The ENEM goal, planned back from the first exam day of the edition ahead. */
function anaGoal({ edition, now }: { edition: EnemEdition; now: Date }): SeedGoal {
  const firstMock = lastSunday(now);

  return {
    course: enemCourse,
    createdDay: -14,
    dailyMinutes: 45,
    details: {
      course: "Medicina",
      exam: "ENEM",
      examYear: edition.year,
      level: "intermediate",
      studyDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      targetScore: 720,
      university: "UFMG",
    },
    exam: "enem",
    key: "enem",
    kind: "exam",
    plan: {
      changes: [
        {
          day: firstMock + 1,
          kind: "edited",
          payload: {
            operations: [{ areas: ["Ciências da Natureza"], kind: "focusAreas" }],
            source: "system",
          },
          reason:
            "Na segunda, passamos 20 min de Ciências Humanas para Ciências da Natureza. Você está indo bem em Humanas.",
        },
        {
          day: -1,
          kind: "edited",
          payload: {
            effect: { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 0 },
            operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
            source: "memory",
          },
          reason: t(
            "You take a prep course on Saturday mornings. Want Saturday to become a rest day in the plan?",
            "Você faz cursinho aos sábados de manhã. Quer que o sábado vire dia de descanso no plano?",
          ),
          status: "proposed",
        },
      ],
      examChoices: [
        {
          group: t("Foreign language", "Língua Estrangeira"),
          subject: t("English", "Língua Inglesa"),
        },
      ],
      focusAreas: ["Ciências da Natureza"],
      graph: anaGraph,
      items: [
        { day: -13, kind: "lesson", lesson: "what-a-percent-is", phase: 0, status: "done" },
        { day: -12, kind: "lesson", lesson: "main-idea", phase: 0, status: "done" },
        { day: -10, kind: "lesson", lesson: "first-republic", phase: 0, status: "done" },
        { day: -8, kind: "lesson", lesson: "rule-of-three", phase: 0, status: "done" },
        { day: firstMock, kind: "mock", phase: 0, status: "done", title: FIRST_MOCK },
        { day: 0, kind: "lesson", lesson: "percent-discount", phase: 0, status: "todo" },
        { day: 1, kind: "lesson", lesson: "raise-then-discount", phase: 0, status: "todo" },
        { day: 2, kind: "lesson", lesson: "food-chain-energy", phase: 0, status: "todo" },
        { day: 3, kind: "lesson", lesson: "ohms-law", phase: 0, status: "todo" },
      ],
      phases: EXAM_PHASES,
    },
    prompt: `quero passar em medicina na federal, vou fazer o enem de ${edition.year}`,
    studyTime: "19:00",
    targetDate: new Date(`${edition.examDays[0]}T00:00:00.000Z`),
    title: `ENEM ${edition.year}`,
  };
}

/**
 * An exam goal: ENEM with a date, 45 minutes a day, six days a week. Her diagnostic
 * found Humanities solid and Science and Math weaker; she took her first mock on Sunday, which
 * earned her the aviator glasses then (already celebrated, so her next session doesn't).
 */
export function buildAna(context: { edition: EnemEdition; now: Date }): SeedLearner {
  // The exam's first day, half of it: the 30 Languages and Humanities questions the bank has.
  const mock = { correct: 21, day: lastSunday(context.now), title: FIRST_MOCK, total: 30 };

  return {
    ...anaProfile,
    goal: anaGoal(context),
    history: { ...anaProfile.history, mocks: [mock] },
    milestones: [
      ...anaProfile.milestones,
      { day: mock.day, key: "aviator", kind: "glasses", shown: true },
    ],
  };
}
