/** A test-out passes at 80% right, like placement's confidence bar. */
export const TEST_OUT_PASS_MARK = 0.8;

/** Enough questions to sample a chapter's skills, few enough to take in two minutes. */
export const TEST_OUT_MAX_QUESTIONS = 8;

/** Never fewer: one lucky answer, or two, never skips a chapter. */
const TEST_OUT_MIN_QUESTIONS = 4;

/** One more question for every this many lessons a pass would skip. */
const LESSONS_PER_QUESTION = 2;

/**
 * How many questions a test-out asks: more the more lessons passing it skips (what it vouches
 * for), from four to eight.
 */
export function getTestOutQuestionCount(lessonsSkipped: number): number {
  return Math.min(
    TEST_OUT_MAX_QUESTIONS,
    Math.max(TEST_OUT_MIN_QUESTIONS, Math.ceil(lessonsSkipped / LESSONS_PER_QUESTION)),
  );
}

/** Each sampled skill's share of the questions: a chapter of one skill asks it several times. */
export function getQuestionsPerSkill({
  questions,
  skills,
}: {
  questions: number;
  skills: number;
}): number {
  return skills > 0 ? Math.ceil(questions / skills) : 0;
}

/** Spreads a test-out over the whole chapter: evenly spaced skills when there are too many. */
export function pickTestOutSkills<TSkill>(skills: readonly TSkill[]): TSkill[] {
  if (skills.length <= TEST_OUT_MAX_QUESTIONS) {
    return [...skills];
  }

  const step = skills.length / TEST_OUT_MAX_QUESTIONS;

  return Array.from(
    { length: TEST_OUT_MAX_QUESTIONS },
    (_, index) => skills[Math.floor(index * step)],
  ).filter((skill) => skill !== undefined);
}

export type TestOutScore = {
  correct: number;
  /** Skills answered 80% right or better: the ones a passed test-out takes off the plan. */
  knownSkillIds: string[];
  missedSkillIds: string[];
  passed: boolean;
  total: number;
};

function isKnownBy(results: readonly { isCorrect: boolean }[]): boolean {
  const right = results.filter((result) => result.isCorrect).length;
  return results.length > 0 && right / results.length >= TEST_OUT_PASS_MARK;
}

/**
 * Scores a test-out. It only vouches for what it asked: passing needs at least four answers, an
 * answer on every skill it samples (each skill of a chapter of up to eight, eight spread over a
 * bigger one) and 80% of the answers right. Then the skills answered 80% right count as known;
 * skills it missed or never asked about stay in the plan, so a chapter with questions on only
 * some of its skills can't be skipped.
 */
export function scoreTestOut({
  chapterSkillIds,
  results,
}: {
  /** The chapter's skills in plan order, which the test-out samples from. */
  chapterSkillIds: readonly string[];
  results: readonly { isCorrect: boolean; skillId: string }[];
}): TestOutScore {
  const correct = results.filter((result) => result.isCorrect).length;

  const bySkill = Map.groupBy(results, (result) => result.skillId);
  const sampled = pickTestOutSkills(chapterSkillIds);

  const passed =
    results.length >= TEST_OUT_MIN_QUESTIONS &&
    sampled.every((skillId) => bySkill.has(skillId)) &&
    correct / results.length >= TEST_OUT_PASS_MARK;

  const known = new Set(
    [...bySkill].filter(([, answers]) => isKnownBy(answers)).map(([skillId]) => skillId),
  );

  return {
    correct,
    knownSkillIds: chapterSkillIds.filter((skillId) => known.has(skillId)),
    missedSkillIds: [...bySkill.keys()].filter((skillId) => !known.has(skillId)),
    passed,
    total: results.length,
  };
}
