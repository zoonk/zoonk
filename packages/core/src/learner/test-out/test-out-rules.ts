import { LOW_GUESS_ANSWERS_TO_SKIP } from "../_utils/placement-guess-rate";
import { type OwnAnswer, isSkillConfirmed } from "../_utils/skill-claims";

export const TEST_OUT_PASS_MARK = 1;
export const TEST_OUT_QUESTIONS_PER_SKILL = 1 + LOW_GUESS_ANSWERS_TO_SKIP;

const MAX_SAMPLED_SKILLS = 8;

export const TEST_OUT_MAX_QUESTIONS = MAX_SAMPLED_SKILLS * TEST_OUT_QUESTIONS_PER_SKILL;

export function pickTestOutSkills<TSkill>(skills: readonly TSkill[]): TSkill[] {
  if (skills.length <= MAX_SAMPLED_SKILLS) {
    return [...skills];
  }

  const step = skills.length / MAX_SAMPLED_SKILLS;

  return Array.from(
    { length: MAX_SAMPLED_SKILLS },
    (_, index) => skills[Math.floor(index * step)],
  ).filter((skill) => skill !== undefined);
}

export function scoreTestOut({
  chapterSkillIds,
  results,
}: {
  chapterSkillIds: readonly string[];
  results: readonly (OwnAnswer & { skillId: string })[];
}) {
  const sampled = pickTestOutSkills(chapterSkillIds);
  const bySkill = Map.groupBy(results, (result) => result.skillId);

  const knownSkillIds = sampled.filter((skillId) =>
    isSkillConfirmed({ answers: bySkill.get(skillId) ?? [] }),
  );

  return {
    correct: results.filter((result) => result.isCorrect).length,
    knownSkillIds,
    passed: sampled.length > 0 && knownSkillIds.length === sampled.length,
    total: results.length,
  };
}
