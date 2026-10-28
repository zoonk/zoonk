import { type TestCase } from "@/lib/types";
import { type SessionPatternsParams } from "@zoonk/ai/tasks/v2/memory/session-patterns";

type ExpectedPattern = { keywords: string[] };

export type SessionPatternsExpected = {
  patterns: ExpectedPattern[];
  forbidden?: string[];
  maxPatterns: number;
};

type SessionPatternsCase = TestCase<SessionPatternsExpected, SessionPatternsParams>;

function patternsCase({
  activity,
  expected,
  id,
  language,
}: {
  activity: string;
  expected: SessionPatternsExpected;
  id: string;
  language: string;
}): SessionPatternsCase {
  return { expected, id, userInput: { activity, language } };
}

const FRACTIONS_AT_NIGHT = [
  "Answers in the last 7 days: 64 on 5 days, 71% right.",
  "By part of the session, over 5 sessions: first third 86% right (22 answers), middle third 72% right (21 answers), last third 55% right (21 answers).",
  "By time of day: 06:00-12:00 52% right (21 answers on 2 days); 21:00-24:00 83% right (43 answers on 4 days).",
  "Skills with the most trouble:",
  "- Percentages: 9 of 18 right, 7 mistakes (5 content gap, 2 fell for a trap)",
  "Recent mistakes on Percentages:",
  '- "What is 3/4 as a percentage?": answered "34%", right answer "75%"',
  '- "Write 2/5 as a percentage": answered "25%", right answer "40%"',
  "Studied on 5 of the last 7 days, 24 minutes a day on average; the plan asks for 30.",
].join("\n");

const AGREEMENT_IN_THE_MORNING = [
  "Answers in the last 7 days: 58 on 4 days, 69% right.",
  "By time of day: 06:00-12:00 84% right (38 answers on 3 days); 18:00-21:00 40% right (20 answers on 2 days).",
  "Skills with the most trouble:",
  "- Concordância verbal: 6 of 16 right, 10 mistakes (8 content gap, 2 misread the question)",
  "Recent mistakes on Concordância verbal:",
  '- "Complete: Fazem / Faz dois anos que me mudei": answered "Fazem", right answer "Faz"',
  '- "Complete: Houveram / Houve muitos problemas": answered "Houveram", right answer "Houve"',
  "Studied on 4 of the last 7 days, 35 minutes a day on average; the plan asks for 30.",
].join("\n");

const ONE_SLIP = [
  "Answers in the last 7 days: 41 on 4 days, 93% right.",
  "Skills with the most trouble:",
  "- Crase: 5 of 6 right, 1 mistake (1 content gap)",
  "Recent mistakes on Crase:",
  '- "Vou à / a escola": answered "a", right answer "à"',
  "Studied on 4 of the last 7 days, 20 minutes a day on average; the plan asks for 20.",
].join("\n");

export const TEST_CASES: SessionPatternsCase[] = [
  patternsCase({
    activity: FRACTIONS_AT_NIGHT,
    expected: {
      forbidden: ["tired", "24 minutes", "minutes a day", "5 of"],
      maxPatterns: 3,
      patterns: [
        { keywords: ["fraction", "percent"] },
        { keywords: ["night", "evening", "9 pm", "21", "pm"] },
      ],
    },
    id: "en-session-patterns",
    language: "en",
  }),
  patternsCase({
    activity: "Answers in the last 7 days: 5 on 1 day, 60% right.",
    expected: { maxPatterns: 0, patterns: [] },
    id: "en-session-too-little",
    language: "en",
  }),
  patternsCase({
    activity: [
      "Answers in the last 7 days: 52 on 5 days, 88% right.",
      "Studied on 5 of the last 7 days, 12 minutes a day on average; the plan asks for 30.",
    ].join("\n"),
    expected: { forbidden: ["minute", "day", "studies", "studied"], maxPatterns: 0, patterns: [] },
    id: "en-session-study-time-only",
    language: "en",
  }),
  patternsCase({
    activity: AGREEMENT_IN_THE_MORNING,
    expected: {
      forbidden: ["35 minutos", "minutos por dia", "4 de"],
      maxPatterns: 3,
      patterns: [{ keywords: ["concordancia"] }, { keywords: ["manha", "cedo"] }],
    },
    id: "pt-session-patterns",
    language: "pt",
  }),
  patternsCase({
    activity: ONE_SLIP,
    expected: { forbidden: ["crase"], maxPatterns: 0, patterns: [] },
    id: "pt-session-one-slip",
    language: "pt",
  }),
];
