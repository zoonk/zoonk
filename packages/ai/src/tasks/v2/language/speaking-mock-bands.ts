/**
 * The exams whose speaking test the live call runs as a mock, with the scale and criteria of each.
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
 * A1), rounded to the nearest half band.
 * https://www.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf
 * https://www.in.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-overview.pdf
 * https://www.ets.org/toefl/institutions/ibt/score-scale-update.html
 */
export const SPEAKING_MOCK_EXAMS = ["ielts", "toefl"] as const;

export type SpeakingMockExam = (typeof SPEAKING_MOCK_EXAMS)[number];

/** In the order the results screen lists them: TOEFL's Listen and Repeat first, as in the test. */
export const SPEAKING_MOCK_CRITERIA = {
  ielts: ["fluencyCoherence", "lexicalResource", "grammar", "pronunciation"],
  toefl: ["repetition", "elaboration", "grammar", "vocabulary", "delivery"],
} as const satisfies Record<SpeakingMockExam, readonly string[]>;

export type SpeakingCriterion<TExam extends SpeakingMockExam = SpeakingMockExam> =
  (typeof SPEAKING_MOCK_CRITERIA)[TExam][number];

export const SPEAKING_MOCK_SCALES = {
  ielts: { max: 9, min: 0, step: 0.5 },
  toefl: { max: 6, min: 1, step: 0.5 },
} as const satisfies Record<SpeakingMockExam, { max: number; min: number; step: number }>;

/** A transcript shows words, not sounds, so the criterion about how the candidate sounds spans a full band. */
const SOUND_CRITERIA: { [TExam in SpeakingMockExam]: SpeakingCriterion<TExam> } = {
  ielts: "pronunciation",
  toefl: "delivery",
};

const SOUND_MIN_WIDTH = 1;

/**
 * Each criterion's share of the overall band. IELTS averages its four criteria. TOEFL's 7 Listen
 * and Repeat items carry 35 of its 55 raw points, so repetition weighs 7 and the four criteria
 * read from the 4 interview answers weigh 1 each.
 */
const OVERALL_WEIGHTS: { [TExam in SpeakingMockExam]: Record<SpeakingCriterion<TExam>, number> } = {
  ielts: { fluencyCoherence: 1, grammar: 1, lexicalResource: 1, pronunciation: 1 },
  toefl: { delivery: 1, elaboration: 1, grammar: 1, repetition: 7, vocabulary: 1 },
};

/** A range wider than one band tells the learner nothing they can act on. */
const MAX_RANGE_WIDTH = 1;

export type BandRange = { bandLow: number; bandHigh: number };

function toBand({ exam, value }: { exam: SpeakingMockExam; value: number }): number {
  const { max, min, step } = SPEAKING_MOCK_SCALES[exam];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** A range of exactly `width` around `center`, moved inside the scale when it would spill over. */
function centeredRange({
  center,
  exam,
  width,
}: {
  center: number;
  exam: SpeakingMockExam;
  width: number;
}): BandRange {
  const { max, min } = SPEAKING_MOCK_SCALES[exam];
  const bandLow = Math.min(max - width, Math.max(min, toBand({ exam, value: center - width / 2 })));
  return { bandHigh: bandLow + width, bandLow };
}

/**
 * Keeps an estimated band range on the exam's scale (IELTS 0 to 9, TOEFL 1 to 6, both in half
 * bands), low end first, at most one band wide, and at least `minWidth` wide. Models return
 * numbers the learner sees, so a reversed, off-scale or overly narrow range never reaches them.
 */
export function normalizeBandRange({
  bandHigh,
  bandLow,
  exam,
  minWidth = 0,
}: BandRange & { exam: SpeakingMockExam; minWidth?: number }): BandRange {
  const low = toBand({ exam, value: Math.min(bandLow, bandHigh) });
  const high = toBand({ exam, value: Math.max(bandLow, bandHigh) });
  const center = (low + high) / 2;

  if (high - low > MAX_RANGE_WIDTH) {
    return centeredRange({ center, exam, width: MAX_RANGE_WIDTH });
  }

  if (high - low < minWidth) {
    return centeredRange({ center, exam, width: Math.min(minWidth, MAX_RANGE_WIDTH) });
  }

  return { bandHigh: high, bandLow: low };
}

/** The minimum width of a criterion's range: a full band for how the candidate sounds. */
export function getMinRangeWidth<TExam extends SpeakingMockExam>({
  criterion,
  exam,
}: {
  criterion: SpeakingCriterion<TExam>;
  exam: TExam;
}): number {
  return SOUND_CRITERIA[exam] === criterion ? SOUND_MIN_WIDTH : 0;
}

function weightedBand<TExam extends SpeakingMockExam>({
  criteria,
  exam,
  side,
}: {
  criteria: readonly (BandRange & { criterion: SpeakingCriterion<TExam> })[];
  exam: TExam;
  side: keyof BandRange;
}): number {
  const weights: Record<SpeakingCriterion<TExam>, number> = OVERALL_WEIGHTS[exam];
  const total = criteria.reduce((sum, item) => sum + weights[item.criterion], 0);
  const sum = criteria.reduce((acc, item) => acc + weights[item.criterion] * item[side], 0);

  return toBand({ exam, value: sum / total });
}

/**
 * The estimated overall band from the criteria, each end apart, rounded to the nearest half band
 * like both exams report it (a TOEFL 5.25 becomes 5.5, a 5.125 becomes 5).
 */
export function getOverallBand<TExam extends SpeakingMockExam>({
  criteria,
  exam,
}: {
  criteria: readonly (BandRange & { criterion: SpeakingCriterion<TExam> })[];
  exam: TExam;
}): BandRange {
  return {
    bandHigh: weightedBand({ criteria, exam, side: "bandHigh" }),
    bandLow: weightedBand({ criteria, exam, side: "bandLow" }),
  };
}
