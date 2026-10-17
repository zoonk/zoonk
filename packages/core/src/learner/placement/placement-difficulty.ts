import { type PlacementEvidence } from "./placement-beliefs";
import { type PlacementSkill, buildSkillGraph } from "./placement-graph";
import { type OwnLevel } from "./placement-steps";

/**
 * Where a question's difficulty starts for each own level, on the item bank's scale: the
 * generator's easy (-1), medium (0) and hard (1), which real answers recalibrate.
 */
const LEVEL_DIFFICULTY: Readonly<Record<OwnLevel, number>> = {
  advanced: 1,
  basic: 0,
  intermediate: 0,
  none: -1,
};

/** One right answer moves the next question in its area one step harder; a wrong one, easier. */
const DIFFICULTY_STEP = 1;
const MAX_TARGET_DIFFICULTY = 2;

/**
 * How hard the next question on a skill should be, like a tutor's staircase: from the learner's
 * own level, one step harder for each right answer in the skill's area and one step easier for
 * each wrong one or "I don't know yet". Areas climb on their own: doing well in math says
 * nothing about history.
 */
export function getTargetDifficulty({
  evidence,
  ownLevel,
  skillId,
  skills,
}: {
  evidence: readonly PlacementEvidence[];
  ownLevel?: OwnLevel | null;
  skillId: string;
  skills: readonly PlacementSkill[];
}): number {
  const graph = buildSkillGraph(skills);
  const area = graph.byId.get(skillId)?.sectionTitle ?? null;

  const steps = evidence
    .filter((answer) => graph.byId.has(answer.skillId))
    .filter((answer) => graph.byId.get(answer.skillId)?.sectionTitle === area)
    .reduce((sum, answer) => sum + (answer.outcome === "correct" ? 1 : -1), 0);

  const target = (ownLevel ? LEVEL_DIFFICULTY[ownLevel] : 0) + steps * DIFFICULTY_STEP;

  return Math.min(MAX_TARGET_DIFFICULTY, Math.max(-MAX_TARGET_DIFFICULTY, target));
}
