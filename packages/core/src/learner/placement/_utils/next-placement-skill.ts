import { chooseNextPlacementSkill } from "../placement-steps";

type SkillChoice = Omit<Parameters<typeof chooseNextPlacementSkill>[0], "askableSkillIds">;

/** Preparing skills retain their walk position, but an available quick question may fill the wait; typed confirmation never does. */
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
