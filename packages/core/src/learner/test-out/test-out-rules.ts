export const TEST_OUT_PASS_MARK = 0.8;

export const TEST_OUT_MAX_QUESTIONS = 8;

/** Lucky guesses must not skip an entire chapter. */
const TEST_OUT_MIN_QUESTIONS = 4;

const LESSONS_PER_QUESTION = 2;

export function getTestOutQuestionCount(lessonsSkipped: number): number {
  return Math.min(
    TEST_OUT_MAX_QUESTIONS,
    Math.max(TEST_OUT_MIN_QUESTIONS, Math.ceil(lessonsSkipped / LESSONS_PER_QUESTION)),
  );
}

export function getQuestionsPerSkill({
  questions,
  skills,
}: {
  questions: number;
  skills: number;
}): number {
  return skills > 0 ? Math.ceil(questions / skills) : 0;
}

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
  /** Includes only sampled skills answered at least 80% right. */
  knownSkillIds: string[];
  missedSkillIds: string[];
  passed: boolean;
  total: number;
};

function isKnownBy(results: readonly { isCorrect: boolean }[]): boolean {
  const right = results.filter((result) => result.isCorrect).length;
  return results.length > 0 && right / results.length >= TEST_OUT_PASS_MARK;
}

/** Requires enough answers across every sampled skill; never assumes unasked skills are known. */
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
