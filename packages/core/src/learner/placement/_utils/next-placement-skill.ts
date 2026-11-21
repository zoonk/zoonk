import { isLowGuessTap } from "../../_utils/placement-guess-rate";
import { getTargetDifficulty } from "../placement-difficulty";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { type PlacementQuickFormat } from "../placement-quick-format";
import { chooseNextPlacementSkill } from "../placement-steps";

type SkillChoice = Omit<Parameters<typeof chooseNextPlacementSkill>[0], "askableSkillIds">;

function chooseNextSkill({
  askableSkillIds,
  choice,
  confirmingSkillId,
  preparingSkillIds,
  quickSkillIds,
}: {
  askableSkillIds: ReadonlySet<string>;
  choice: SkillChoice;
  confirmingSkillId: string | undefined;
  preparingSkillIds: ReadonlySet<string>;
  quickSkillIds: ReadonlySet<string>;
}): string | null {
  if (confirmingSkillId) {
    return confirmingSkillId;
  }

  const next = chooseNextPlacementSkill({
    ...choice,
    askableSkillIds: new Set([...askableSkillIds, ...preparingSkillIds]),
  });

  if (next === null || askableSkillIds.has(next)) {
    return next;
  }

  const lastSkillId = choice.evidence.at(-1)?.skillId;
  const ready = new Set([...quickSkillIds].filter((skillId) => skillId !== lastSkillId));
  return chooseNextPlacementSkill({ ...choice, askableSkillIds: ready }) ?? next;
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

  const last = evidence.at(-1);

  const confirmingSkillId =
    last?.outcome === "correct" &&
    choice.statuses.get(last.skillId) !== "known" &&
    skills.some((skill) => skill.id === last.skillId) &&
    unseen.some((item) => item.skillId === last.skillId && isLowGuessTap(item))
      ? last.skillId
      : undefined;

  const skillId = chooseNextSkill({
    askableSkillIds,
    choice,
    confirmingSkillId,
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
