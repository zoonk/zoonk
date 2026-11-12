import { getTargetDifficulty } from "../placement-difficulty";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { type PlacementQuickFormat } from "../placement-quick-format";
import { chooseNextPlacementSkill } from "../placement-steps";

type SkillChoice = Omit<Parameters<typeof chooseNextPlacementSkill>[0], "askableSkillIds">;

/** Preparing skills retain their walk position, but an available quick question may fill the wait; typed confirmation never does. */
function chooseNextSkill({
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

/** The question to ask next: the item when one is ready, or its skill while it's still being written. */
export function findNextQuestion({
  choice,
  items,
  preparingSkillIds,
  quickFormat,
  waitsForExam,
}: {
  choice: SkillChoice;
  items: readonly PlacementItemCandidate[];
  preparingSkillIds: ReadonlySet<string>;
  quickFormat: PlacementQuickFormat;
  waitsForExam: boolean;
}) {
  const { evidence, ownLevel, skills } = choice;
  const unseen = items.filter((item) => !item.seen);
  const askableSkillIds = new Set(unseen.map((item) => item.skillId));

  const skillId = chooseNextSkill({
    askableSkillIds,
    choice,
    preparingSkillIds,
    quickSkillIds: new Set(
      unseen.filter((item) => item.format === quickFormat).map((item) => item.skillId),
    ),
  });

  const waiting = skillId !== null && !askableSkillIds.has(skillId);

  const item =
    skillId && !waiting && !waitsForExam
      ? pickPlacementItem({
          confirming: evidence.some(
            (answer) => answer.skillId === skillId && answer.outcome === "correct",
          ),
          items,
          quickFormat,
          skillId,
          targetDifficulty: getTargetDifficulty({ evidence, ownLevel, skillId, skills }),
        })
      : null;

  return { askableSkillIds, item, skillId: item || waiting ? skillId : null, waiting };
}
