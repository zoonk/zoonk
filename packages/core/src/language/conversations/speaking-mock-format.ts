import { type SpeakingMockExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import {
  type SpeakingCriterion,
  type SpeakingScale,
  toBand,
} from "@zoonk/ai/tasks/v2/language/speaking-bands";

/**
 * The criteria of each exam whose speaking test the live call runs as a mock, in the order the
 * results screen lists them.
 *
 * IELTS Speaking: four criteria on the 0 to 9 band scale in half bands; the speaking band is the
 * mean of the four.
 *
 * TOEFL iBT Speaking, as updated in January 2026 (checked Sep 2026): two tasks, Listen and Repeat
 * (7 sentences in a campus or academic setting, each longer and more complex, heard once, 8 to 12
 * seconds to repeat each) and Take an Interview (4 questions, 45 seconds each, from facts and
 * personal experience to opinions on broader issues). Each of the 11 items is scored 0 to 5, so
 * Listen and Repeat carries 35 of the 55 raw points. Repetition is judged on accuracy and
 * intelligibility; interview answers on coherent elaboration, a conversational pace, intelligible
 * rhythm and intonation, and a range of accurate vocabulary and grammar. Sections are reported on
 * a 1 to 6 band in half bands (6 C2, 5 to 5.5 C1, 4 to 4.5 B2, 3 to 3.5 B1, 2 to 2.5 A2, 1 to 1.5
 * A1), rounded to the nearest half band; Listen and Repeat comes first, as in the test.
 * https://www.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf
 * https://www.in.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-overview.pdf
 * https://www.ets.org/toefl/institutions/ibt/score-scale-update.html
 */
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

/** How the candidate sounds: a transcript can't show it, and typed replies aren't rated on it. */
const SOUND_CRITERIA: { [TExam in SpeakingMockExam]: MockCriterion<TExam> } = {
  ielts: "pronunciation",
  toefl: "delivery",
};

/**
 * Each criterion's share of the overall band. IELTS averages its four criteria. TOEFL's 7 Listen
 * and Repeat items carry 35 of its 55 raw points, so repetition weighs 7 and the four criteria
 * read from the 4 interview answers weigh 1 each.
 */
const OVERALL_WEIGHTS: { [TExam in SpeakingMockExam]: Record<MockCriterion<TExam>, number> } = {
  ielts: { fluencyCoherence: 1, grammar: 1, lexicalResource: 1, pronunciation: 1 },
  toefl: { delivery: 1, elaboration: 1, grammar: 1, repetition: 7, vocabulary: 1 },
};

/** A speaking mock: IELTS's three parts or TOEFL's two tasks, shortened to about five minutes. */
export const SPEAKING_MOCK_MINUTES = 5;

/** How the exam names its test, and what the mock runs of it. */
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

/**
 * What the speaking grader rates a mock on: the whole test, run as one shorter call, on its exam's
 * criteria and scale.
 */
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

/**
 * The estimated overall band from the criteria rated, each end apart, rounded to the nearest half
 * band like both exams report it (a TOEFL 5.25 becomes 5.5, a 5.125 becomes 5).
 */
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
