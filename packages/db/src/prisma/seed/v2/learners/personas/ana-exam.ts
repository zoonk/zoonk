import { MS_PER_DAY } from "@zoonk/utils/date";
import { localDay } from "../../_utils/dates";
import { enemCourse } from "../../library/enem/enem-course";
import { type EnemEdition } from "../../library/enem/enem-edition";
import { type SeedAttempt, type SeedGoal, type SeedLearner } from "../types";

const TIME_ZONE = "America/Sao_Paulo";
const DAYS_PER_WEEK = 7;
const FIRST_MOCK = "Simulado 1: Ciências da Natureza e Matemática";

/** Days from today (in São Paulo) to an ISO date. */
function daysUntil(isoDate: string, now: Date): number {
  return Math.round(
    (new Date(`${isoDate}T00:00:00.000Z`).getTime() - localDay(now, TIME_ZONE).getTime()) /
      MS_PER_DAY,
  );
}

/** Days until the next Sunday, when her weekly mock runs; never today. */
function nextSunday(now: Date): number {
  return DAYS_PER_WEEK - localDay(now, TIME_ZONE).getUTCDay();
}

/** Days back to the last Sunday, when she took her first mock; never today. */
function lastSunday(now: Date): number {
  return nextSunday(now) - DAYS_PER_WEEK;
}

/**
 * The four exam phases, sized to the days left: foundations, gaps, practice and the final stretch.
 * Her hand-placed plan items only fit inside them from 38 days out, so `getPlannedEnemEdition`
 * keeps her exam at least two months away.
 */
function examPhases(examDay: number) {
  const gaps = Math.round(examDay * 0.2);
  const practice = Math.round(examDay * 0.55);
  const finalStretch = examDay - DAYS_PER_WEEK;

  return {
    gaps,
    phases: [
      { endDay: gaps - 1, kind: "foundations" as const, name: "", startDay: -14 },
      { endDay: practice - 1, kind: "gaps" as const, name: "", startDay: gaps },
      { endDay: finalStretch - 1, kind: "practice" as const, name: "", startDay: practice },
      { endDay: examDay - 1, kind: "finalStretch" as const, name: "", startDay: finalStretch },
    ],
    practice,
  };
}

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
  {
    answer: { selectedIndex: 1 },
    day: 0,
    inSession: true,
    isCorrect: true,
    item: "energy-loss-reason",
    key: "review-energy",
    seconds: 30,
    skill: "energy-flow",
  },
  {
    answer: { selectedIndex: 0 },
    day: 0,
    inSession: true,
    isCorrect: true,
    item: "beach-sign",
    key: "review-sign",
    seconds: 18,
    skill: "inference",
  },
];

const anaProfile: Omit<SeedLearner, "goal"> = {
  attempts: anaAttempts,
  brainPower: 4340,
  email: "v2-exam@zoonk.test",
  feedback: [
    { item: "clt-era", kind: "item", vote: "up" },
    {
      comment: "Fácil demais para o nível do ENEM.",
      item: "beach-sign",
      kind: "item",
      reasons: ["tooEasy"],
      vote: "down",
    },
  ],
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
  session: {
    blocks: [
      {
        brainPower: 25,
        capsules: [
          { items: ["energy-loss-reason"], skills: ["energy-flow"], title: "Ecologia" },
          { items: ["beach-sign"], skills: ["inference"], title: "Interpretação de texto" },
        ],
        kind: "review",
        minutes: 6,
        status: "completed",
      },
      { kind: "learn", lesson: "percent-discount", minutes: 14, status: "active" },
      {
        drills: [
          { items: ["discount-shirt"], mistake: "shirt-discount" },
          { items: ["flashlight-current"], mistake: "circuit-one-resistor" },
          { items: ["fund-gain-loss"], mistake: "fund-trap" },
        ],
        items: ["discount-refrigerator", "buy-five-pay-four", "clt-era"],
        kind: "practice",
        minutes: 16,
        status: "pending",
        title: "Questões no formato do ENEM",
      },
    ],
    status: "active",
  },
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
  const examDay = daysUntil(edition.examDays[0], now);
  const { gaps, phases, practice } = examPhases(examDay);
  const sunday = nextSunday(now);
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
            operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
            source: "memory",
          },
          reason:
            "Você faz cursinho aos sábados de manhã. Quer que o sábado vire dia de descanso no plano?",
          status: "proposed",
        },
      ],
      focusAreas: ["Ciências da Natureza"],
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
        {
          day: sunday,
          kind: "mock",
          phase: 0,
          status: "todo",
          title: "Simulado 2: Ciências da Natureza e Matemática",
        },
        {
          day: gaps - 1,
          kind: "boss",
          phase: 0,
          status: "todo",
          title: "Desafio da fase Fundamentos",
        },
        { chapter: "statistics", day: gaps, kind: "chapter", phase: 1, status: "todo" },
        { day: gaps + 1, kind: "lesson", lesson: "vargas-era", phase: 1, status: "todo" },
        { chapter: "electricity", day: gaps + 3, kind: "chapter", phase: 1, status: "todo" },
        { day: gaps + 4, kind: "lesson", lesson: "what-a-text-implies", phase: 1, status: "todo" },
        { chapter: "essay", day: gaps + 6, kind: "chapter", phase: 1, status: "todo" },
        { chapter: "functions", day: gaps + 9, kind: "chapter", phase: 1, status: "todo" },
        {
          day: practice,
          kind: "mock",
          phase: 2,
          status: "todo",
          title: "Simulado 3: prova completa do 2º dia",
        },
        {
          day: practice + DAYS_PER_WEEK,
          kind: "mock",
          phase: 2,
          status: "todo",
          title: "Simulado 4: prova completa do 1º dia",
        },
        {
          day: examDay - 3,
          kind: "review",
          phase: 3,
          status: "todo",
          title: "Revisão final dos seus erros",
        },
      ],
      phases,
      skillLessons: {
        "buy-x-pay-y": 7,
        "central-tendency": 7,
        "coffee-with-milk": 7,
        "energy-flow": 7,
        "essay-competencies": 7,
        "essay-conclusion": 7,
        inference: 7,
        "intervention-proposal": 7,
        "linear-function": 7,
        "main-idea": 7,
        "ohms-law": 7,
        "percent-basics": 7,
        "percent-discount": 7,
        "percent-factor": 7,
        "quadratic-function": 7,
        "read-charts": 7,
        "rule-of-three": 7,
        "series-resistors": 7,
        "successive-percent": 7,
        "ten-percent-rule": 7,
        "vargas-era": 7,
      },
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
  const mock = { correct: 31, day: lastSunday(context.now), title: FIRST_MOCK, total: 45 };

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
