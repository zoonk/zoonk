/** A test-out passes at 80% right, like placement's confidence bar. */
export const TEST_OUT_PASS_MARK = 0.8;

/** Enough questions to sample a chapter's skills, few enough to take in two minutes. */
export const TEST_OUT_MAX_QUESTIONS = 8;

/** Answers on fewer skills than this can't show a chapter is known. */
const TEST_OUT_MIN_SKILLS = 3;

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
  /** When passed: every chapter skill not missed. Otherwise: only skills answered right. */
  knownSkillIds: string[];
  missedSkillIds: string[];
  passed: boolean;
  total: number;
};

/**
 * Scores a test-out. Passing needs answers on at least three different skills (or all of them, in
 * a smaller chapter) and 80% of the answers right; then the whole chapter counts as known except
 * the skills the learner missed, which stay in the plan. A failed test-out only credits the skills
 * answered right.
 */
export function scoreTestOut({
  chapterSkillIds,
  results,
  testableSkillCount,
}: {
  chapterSkillIds: readonly string[];
  results: readonly { isCorrect: boolean; skillId: string }[];
  /** Chapter skills that have questions to ask. */
  testableSkillCount: number;
}): TestOutScore {
  const correct = results.filter((result) => result.isCorrect).length;

  const missed = new Set(
    results.filter((result) => !result.isCorrect).map((result) => result.skillId),
  );

  const answeredSkills = new Set(results.map((result) => result.skillId)).size;
  const requiredSkills = Math.min(TEST_OUT_MIN_SKILLS, testableSkillCount);

  const passed =
    results.length > 0 &&
    answeredSkills >= requiredSkills &&
    correct / results.length >= TEST_OUT_PASS_MARK;

  const answeredRight = new Set(
    results
      .filter((result) => result.isCorrect && !missed.has(result.skillId))
      .map((result) => result.skillId),
  );

  return {
    correct,
    knownSkillIds: chapterSkillIds.filter((skillId) =>
      passed ? !missed.has(skillId) : answeredRight.has(skillId),
    ),
    missedSkillIds: [...missed],
    passed,
    total: results.length,
  };
}
