import { type SpeakingMockExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import {
  type SpeakingCriterion,
  type SpeakingScale,
  toBand,
} from "@zoonk/ai/tasks/v2/language/speaking-bands";

/** Exam task and scale constraints: https://www.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf and https://www.ets.org/toefl/institutions/ibt/score-scale-update.html. */
export const SPEAKING_MOCK_CRITERIA = {
  ielts: ["fluencyCoherence", "lexicalResource", "grammar", "pronunciation"],
  toefl: ["repetition", "elaboration", "grammar", "vocabulary", "delivery"],
} as const satisfies Record<SpeakingMockExam, readonly string[]>;

type MockCriterion<TExam extends SpeakingMockExam> = (typeof SPEAKING_MOCK_CRITERIA)[TExam][number];

export const SPEAKING_MOCK_SCALES = {
  ielts: { halfBands: true, maxBand: 9, minBand: 0 },
  toefl: { halfBands: true, maxBand: 6, minBand: 1 },
} as const satisfies Record<SpeakingMockExam, SpeakingScale>;

const CRITERION_NAMES: { [TExam in SpeakingMockExam]: Record<MockCriterion<TExam>, string> } = {
  ielts: {
    fluencyCoherence: "Fluency and Coherence",
    grammar: "Grammatical Range and Accuracy",
    lexicalResource: "Lexical Resource",
    pronunciation: "Pronunciation",
  },
  toefl: {
    delivery: "Delivery",
    elaboration: "Elaboration",
    grammar: "Grammar",
    repetition: "Listen and Repeat",
    vocabulary: "Vocabulary",
  },
};

const SOUND_CRITERIA: { [TExam in SpeakingMockExam]: MockCriterion<TExam> } = {
  ielts: "pronunciation",
  toefl: "delivery",
};

/** TOEFL repetition carries 7 of 11 items; the four interview criteria share the remaining weight. */
const OVERALL_WEIGHTS: { [TExam in SpeakingMockExam]: Record<MockCriterion<TExam>, number> } = {
  ielts: { fluencyCoherence: 1, grammar: 1, lexicalResource: 1, pronunciation: 1 },
  toefl: { delivery: 1, elaboration: 1, grammar: 1, repetition: 7, vocabulary: 1 },
};

export const SPEAKING_MOCK_MINUTES = 5;

const MOCK_TESTS: Record<SpeakingMockExam, { brief: string; title: string }> = {
  ielts: { brief: "The test's three parts in a shorter call", title: "IELTS Speaking" },
  toefl: {
    brief: "Listen and Repeat, then Take an Interview, in a shorter call",
    title: "TOEFL iBT Speaking",
  },
};

function listCriteria(exam: SpeakingMockExam): SpeakingCriterion[] {
  const names: Record<string, string> = CRITERION_NAMES[exam];

  return SPEAKING_MOCK_CRITERIA[exam].map((key) => ({
    ...SPEAKING_MOCK_SCALES[exam],
    key,
    levelBand: null,
    name: names[key] ?? key,
    scope: "task",
    sound: SOUND_CRITERIA[exam] === key,
    voiceOnly: SOUND_CRITERIA[exam] === key,
  }));
}

export function getSpeakingMockRating(exam: SpeakingMockExam) {
  const { brief, title } = MOCK_TESTS[exam];
  const minutes = { max: SPEAKING_MOCK_MINUTES, min: SPEAKING_MOCK_MINUTES };

  return {
    criteria: listCriteria(exam),
    task: { brief, minutes, name: "Speaking mock", role: "examiner" as const },
    title,
  };
}

type GradedBand = { bandHigh: number; bandLow: number; criterion: string };

function weightedBand({
  criteria,
  exam,
  side,
}: {
  criteria: readonly GradedBand[];
  exam: SpeakingMockExam;
  side: "bandHigh" | "bandLow";
}): number {
  const weights: Record<string, number> = OVERALL_WEIGHTS[exam];
  const weightOf = (item: GradedBand) => weights[item.criterion] ?? 0;
  const total = criteria.reduce((sum, item) => sum + weightOf(item), 0);
  const sum = criteria.reduce((acc, item) => acc + weightOf(item) * item[side], 0);

  return toBand({ scale: SPEAKING_MOCK_SCALES[exam], value: sum / total });
}

export function getSpeakingMockOverall({
  criteria,
  exam,
}: {
  criteria: readonly GradedBand[];
  exam: SpeakingMockExam;
}): { bandHigh: number; bandLow: number } {
  return {
    bandHigh: weightedBand({ criteria, exam, side: "bandHigh" }),
    bandLow: weightedBand({ criteria, exam, side: "bandLow" }),
  };
}
