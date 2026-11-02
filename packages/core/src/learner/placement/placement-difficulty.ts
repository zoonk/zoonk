import { type PlacementEvidence } from "./placement-beliefs";
import { type PlacementSkill, buildSkillGraph } from "./placement-graph";
import { type OwnLevel } from "./placement-steps";

/** Item-bank scale: easy -1, medium 0, hard 1. */
const LEVEL_DIFFICULTY: Readonly<Record<OwnLevel, number>> = {
  advanced: 1,
  basic: 0,
  intermediate: 0,
  none: -1,
};

const DIFFICULTY_STEP = 1;
const MAX_TARGET_DIFFICULTY = 2;

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
