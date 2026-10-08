import { type MockCandidate } from "./mock-plan";

/**
 * A bank this close to a mock's size starts it as it is: writing two questions isn't worth the
 * learner's wait. The mock says its real size.
 */
const NEAR_FULL_SHARE = 0.9;

/** However few skills a mock asks about, each gets at most this many new questions written. */
const MAX_QUESTIONS_PER_SKILL = 15;

/** Whether the bank's questions fall short of the option's (see `NEAR_FULL_SHARE`). */
export function isMockShort({
  option,
  planned,
}: {
  option: { questions: number };
  planned: number;
}): boolean {
  return planned < Math.ceil(option.questions * NEAR_FULL_SHARE);
}

/**
 * What to write before a mock can start when the bank holds too few questions the learner hasn't
 * answered: each of its skills' share of the mock, for the skills short of it. Null when the bank
 * holds enough, or no skill is short (the mock starts with what there is).
 */
export function getMockQuestionsShortfall({
  candidates,
  option,
  planned,
  skillIds,
}: {
  candidates: readonly MockCandidate[];
  option: { questions: number };
  /** The questions the mock asks from the bank as it is (see `countPlannedQuestions`). */
  planned: number;
  /** The plan's skills the mock asks about, which questions are written for. */
  skillIds: readonly string[];
}): { questionsPerSkill: number; skillIds: string[] } | null {
  if (!isMockShort({ option, planned }) || skillIds.length === 0) {
    return null;
  }

  const questionsPerSkill = Math.min(
    MAX_QUESTIONS_PER_SKILL,
    Math.ceil(option.questions / skillIds.length),
  );

  const unseen = Map.groupBy(candidates, (candidate) => candidate.skillId);
  const short = skillIds.filter((id) => (unseen.get(id)?.length ?? 0) < questionsPerSkill);

  return short.length > 0 ? { questionsPerSkill, skillIds: short } : null;
}
