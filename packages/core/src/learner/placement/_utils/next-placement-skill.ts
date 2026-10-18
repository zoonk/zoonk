import { chooseNextPlacementSkill } from "../placement-steps";

type SkillChoice = Omit<Parameters<typeof chooseNextPlacementSkill>[0], "askableSkillIds">;

/**
 * The skill placement asks next. Skills whose questions are still being written count as askable,
 * so the walk keeps its order; but while the one it goes to is written, a quick question already in
 * the bank on another undecided skill is asked instead (not the skill just answered again), so the
 * learner never waits while one is ready. A question answered in words only confirms a quick one,
 * so it never fills in. Placement waits only when no quick question is ready.
 */
export function chooseNextSkill({
  askableSkillIds,
  choice,
  preparingSkillIds,
  quickSkillIds,
}: {
  askableSkillIds: ReadonlySet<string>;
  choice: SkillChoice;
  preparingSkillIds: ReadonlySet<string>;
  /** Skills with an unseen question in the goal's quick format. */
  quickSkillIds: ReadonlySet<string>;
}): string | null {
  const walkSkillId = chooseNextPlacementSkill({
    ...choice,
    askableSkillIds: new Set([...askableSkillIds, ...preparingSkillIds]),
  });

  if (walkSkillId === null || askableSkillIds.has(walkSkillId)) {
    return walkSkillId;
  }

  const lastSkillId = choice.evidence.at(-1)?.skillId;
  const ready = [...quickSkillIds].filter((skillId) => skillId !== lastSkillId);

  return chooseNextPlacementSkill({ ...choice, askableSkillIds: new Set(ready) }) ?? walkSkillId;
}
