import { type TestCase } from "@/lib/types";
import { type MemoryInsightParams } from "@zoonk/ai/tasks/v2/memory/insight";
import { type MemoryInsightOutput } from "@zoonk/ai/tasks/v2/memory/insight-rules";

export type MemoryInsightExpected = {
  /** The kinds the signals call for, the best first. */
  kinds: MemoryInsightOutput["kind"][];
  /** Words the message should use for what the signals point at. */
  mentions?: string[];
  /** Words that show the message is in the learner's language. */
  languageWords?: string[];
  /** For a schedule idea, the hours (24-hour clock) a suggested time may start in. */
  studyHours?: [number, number];
  /** For a plan change, the 1-based skill it must pick. */
  skill?: number;
  /** For a plan change, words that say its real size: "lesson", "a few lessons", "chapter". */
  sizeWords?: string[];
  /** For a plan change, words that would make it sound smaller or bigger than it is. */
  wrongSizeWords?: string[];
};

type InsightCase = TestCase<MemoryInsightExpected, MemoryInsightParams>;

type InsightSkill = MemoryInsightParams["skills"][number];

const ALL_KINDS: MemoryInsightParams["kinds"] = ["tip", "planChange", "scheduleIdea"];
const NO_PLAN_CHANGE: MemoryInsightParams["kinds"] = ["tip", "scheduleIdea"];

const FACTS: MemoryInsightParams["facts"] = [
  { category: "goals", statement: "Wants Law at a public university" },
  { category: "routine", statement: "Works until 7 pm on weekdays" },
];

const PT_FACTS: MemoryInsightParams["facts"] = [
  { category: "goals", statement: "Quer Direito na USP" },
  { category: "routine", statement: "Trabalha até as 19h nos dias de semana" },
];

const FADING_SESSIONS = [
  "Answers in the last 7 days: 96 on 5 days, 77% right.",
  "By part of the session, over 6 sessions: first third 92% right (32 answers), middle third 84% right (32 answers), last third 55% right (32 answers).",
  "Studied on 5 of the last 7 days, 31 minutes a day on average; the plan asks for 30.",
].join("\n");

const TIME_OF_DAY = [
  "Answers in the last 7 days: 100 on 6 days, 74% right.",
  "By time of day: 06:00-12:00 55% right (40 answers on 3 days); 21:00-24:00 87% right (60 answers on 4 days).",
  "Studied on 6 of the last 7 days, 28 minutes a day on average; the plan asks for 30.",
].join("\n");

const WEAK_SKILL = [
  "Answers in the last 7 days: 58 on 4 days, 79% right.",
  "Skills with the most trouble:",
  "- Percentages: 9 of 18 right, 8 mistakes (6 content gap, 2 fell for a trap)",
  "Recent mistakes on Percentages:",
  '- "What is 3/4 as a percentage?": answered "34%", right answer "75%"',
  '- "Write 2/5 as a percentage": answered "25%", right answer "40%"',
  '- "A price drops from $80 by 1/4. What percent off is that?": answered "14%", right answer "25%"',
  "Studied on 4 of the last 7 days, 26 minutes a day on average; the plan asks for 30.",
].join("\n");

const FLAT = [
  "Answers in the last 7 days: 84 on 5 days, 81% right.",
  "By part of the session, over 5 sessions: first third 82% right (28 answers), middle third 80% right (28 answers), last third 81% right (28 answers).",
  "Studied on 5 of the last 7 days, 30 minutes a day on average; the plan asks for 30.",
].join("\n");

const PT_WEAK_SKILL = [
  "Answers in the last 7 days: 52 on 4 days, 75% right.",
  "Skills with the most trouble:",
  "- Regra de três: 5 of 14 right, 7 mistakes (5 content gap, 2 misread the question)",
  "Recent mistakes on Regra de três:",
  '- "Se 3 pedreiros levam 12 dias, quantos dias levam 6 pedreiros?": answered "24", right answer "6"',
  '- "Se 4 cadernos custam R$ 20, quanto custam 10?": answered "40", right answer "50"',
  "Studied on 4 of the last 7 days, 25 minutes a day on average; the plan asks for 30.",
].join("\n");

const FRACTIONS_LESSON: InsightSkill = {
  chapter: null,
  covers: ["Fractions as percentages"],
  lessons: 1,
  name: "Fractions as percentages",
  prepares: "Percentages",
};

const FRACTIONS_FEW: InsightSkill = {
  chapter: null,
  covers: ["Equivalent fractions", "Simplifying fractions", "Fractions as percentages"],
  lessons: 3,
  name: "Fractions as percentages",
  prepares: "Percentages",
};

const FRACTIONS_CHAPTER: InsightSkill = {
  chapter: "Working with fractions",
  covers: [
    "What fractions are",
    "Equivalent fractions",
    "Simplifying fractions",
    "Comparing fractions",
    "Fractions as decimals",
    "Fractions as percentages",
  ],
  lessons: 7,
  name: "Fractions as percentages",
  prepares: "Percentages",
};

const DECIMALS_LESSON: InsightSkill = {
  chapter: null,
  covers: ["Rounding decimals"],
  lessons: 1,
  name: "Rounding decimals",
  prepares: "Percentages",
};

const PT_PROPORTION_LESSON: InsightSkill = {
  chapter: null,
  covers: ["Grandezas direta e inversamente proporcionais"],
  lessons: 1,
  name: "Grandezas direta e inversamente proporcionais",
  prepares: "Regra de três",
};

const PT_PROPORTION_FEW: InsightSkill = {
  chapter: null,
  covers: ["Razão", "Proporção", "Grandezas direta e inversamente proporcionais"],
  lessons: 3,
  name: "Grandezas direta e inversamente proporcionais",
  prepares: "Regra de três",
};

const PT_FRACTIONS_CHAPTER: InsightSkill = {
  chapter: "Frações no dia a dia",
  covers: [
    "O que é uma fração",
    "Frações equivalentes",
    "Simplificação de frações",
    "Frações e porcentagens",
  ],
  lessons: 6,
  name: "Frações e porcentagens",
  prepares: "Porcentagem",
};

const PT_PERCENT_WEAK_SKILL = [
  "Answers in the last 7 days: 60 on 5 days, 72% right.",
  "Skills with the most trouble:",
  "- Porcentagem: 8 of 20 right, 11 mistakes (9 content gap, 2 guessed)",
  "Recent mistakes on Porcentagem:",
  '- "Quanto é 3/4 em porcentagem?": answered "34%", right answer "75%"',
  '- "Escreva 2/5 como porcentagem": answered "25%", right answer "40%"',
  '- "Um produto de R$ 80 tem desconto de 1/4. Qual a porcentagem do desconto?": answered "14%", right answer "25%"',
  "Studied on 5 of the last 7 days, 28 minutes a day on average; the plan asks for 30.",
].join("\n");

/** Words that say a gap of several lessons, in the two eval languages. */
const EN_FEW_WORDS = ["few", "3 short lessons", "three", "3 lessons"];
const PT_FEW_WORDS = ["algumas", "3 aulas", "tres", "3 licoes", "poucas"];

/** Saying one lesson for a bigger gap, or a bigger gap for one lesson, understates or overstates it. */
const EN_ONE_LESSON_WORDS = ["a lesson", "one lesson", "a short lesson", "a 3-minute lesson"];
const PT_ONE_LESSON_WORDS = ["uma aula", "uma licao", "uma so aula"];
const EN_BIGGER_WORDS = ["few", "chapter"];
const PT_BIGGER_WORDS = ["algumas", "capitulo"];

function insightCase({
  expected,
  facts = FACTS,
  goal = "ENEM 2026",
  id,
  kinds = ALL_KINDS,
  language = "en",
  recentInsights = [],
  signals,
  skills = [],
  studyTime = "07:00",
}: Partial<MemoryInsightParams> & {
  expected: MemoryInsightExpected;
  id: string;
  signals: string;
}): InsightCase {
  return {
    expected,
    id,
    userInput: { facts, goal, kinds, language, recentInsights, signals, skills, studyTime },
  };
}

export const TEST_CASES: InsightCase[] = [
  insightCase({
    expected: { kinds: ["tip"], mentions: ["break", "pause", "last", "end"] },
    id: "en-tip-fading-sessions",
    signals: FADING_SESSIONS,
  }),
  insightCase({
    expected: {
      kinds: ["scheduleIdea"],
      mentions: ["pm", "evening", "night", ":00"],
      studyHours: [20, 23],
    },
    id: "en-schedule-evening",
    signals: TIME_OF_DAY,
  }),
  insightCase({ expected: { kinds: ["none"] }, id: "en-none-flat", signals: FLAT }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      mentions: ["fraction"],
      sizeWords: ["lesson"],
      skill: 1,
      wrongSizeWords: EN_BIGGER_WORDS,
    },
    id: "en-plan-change-weak-skill",
    signals: WEAK_SKILL,
    skills: [FRACTIONS_LESSON],
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      mentions: ["fraction"],
      sizeWords: EN_FEW_WORDS,
      skill: 1,
      wrongSizeWords: EN_ONE_LESSON_WORDS,
    },
    id: "en-plan-change-few-lessons",
    signals: WEAK_SKILL,
    skills: [FRACTIONS_FEW],
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      mentions: ["fraction"],
      sizeWords: ["chapter"],
      skill: 1,
      wrongSizeWords: EN_ONE_LESSON_WORDS,
    },
    id: "en-plan-change-chapter",
    signals: WEAK_SKILL,
    skills: [FRACTIONS_CHAPTER],
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      mentions: ["fraction"],
      sizeWords: ["chapter"],
      skill: 2,
      wrongSizeWords: EN_ONE_LESSON_WORDS,
    },
    id: "en-plan-change-picks-chapter-gap",
    signals: WEAK_SKILL,
    skills: [DECIMALS_LESSON, FRACTIONS_CHAPTER],
  }),
  insightCase({
    expected: { kinds: ["tip", "none"], mentions: ["fraction", "percent"] },
    id: "en-no-plan-change-allowed",
    kinds: NO_PLAN_CHANGE,
    signals: WEAK_SKILL,
  }),
  insightCase({
    expected: { kinds: ["none"] },
    id: "en-none-already-said",
    recentInsights: [
      "You miss the last questions of a session more often than the first ones. Try a two-minute break before them.",
    ],
    signals: FADING_SESSIONS,
  }),
  insightCase({
    expected: { kinds: ["none"] },
    id: "en-none-too-few-answers",
    signals: "Answers in the last 7 days: 8 on 2 days, 50% right.",
  }),
  insightCase({
    expected: {
      kinds: ["scheduleIdea"],
      languageWords: ["voce", "seu", "sua", "estud", "quer"],
      mentions: ["21", "22", "noite", "h"],
      studyHours: [20, 23],
    },
    facts: PT_FACTS,
    id: "pt-schedule-evening",
    language: "pt",
    signals: TIME_OF_DAY,
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      languageWords: ["voce", "quer", "aula", "licao"],
      mentions: ["regra de tres", "proporc", "inversa"],
      sizeWords: ["aula", "licao"],
      skill: 1,
      wrongSizeWords: PT_BIGGER_WORDS,
    },
    facts: PT_FACTS,
    id: "pt-plan-change-weak-skill",
    language: "pt",
    signals: PT_WEAK_SKILL,
    skills: [PT_PROPORTION_LESSON],
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      languageWords: ["voce", "aula", "licao", "sua", "seu"],
      mentions: ["regra de tres", "proporc", "razao"],
      sizeWords: PT_FEW_WORDS,
      skill: 1,
      wrongSizeWords: PT_ONE_LESSON_WORDS,
    },
    facts: PT_FACTS,
    id: "pt-plan-change-few-lessons",
    language: "pt",
    signals: PT_WEAK_SKILL,
    skills: [PT_PROPORTION_FEW],
  }),
  insightCase({
    expected: {
      kinds: ["planChange"],
      languageWords: ["voce", "capitulo", "sua", "seu"],
      mentions: ["frac"],
      sizeWords: ["capitulo"],
      skill: 1,
      wrongSizeWords: PT_ONE_LESSON_WORDS,
    },
    facts: PT_FACTS,
    id: "pt-plan-change-chapter",
    language: "pt",
    signals: PT_PERCENT_WEAK_SKILL,
    skills: [PT_FRACTIONS_CHAPTER],
  }),
  insightCase({
    expected: {
      kinds: ["tip"],
      languageWords: ["voce", "tente", "faca", "sua", "seu"],
      mentions: ["pausa", "intervalo", "final", "ultimas"],
    },
    facts: PT_FACTS,
    id: "pt-tip-fading-sessions",
    language: "pt",
    signals: FADING_SESSIONS,
  }),
];
