import "server-only";
import { type ItemFormat } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getPlacementBeliefs } from "../placement-beliefs";
import { type PlacementQuickFormat, compareQuickFormat } from "../placement-quick-format";
import { getUndecidedSkills } from "../placement-steps";
import { loadEvidence, loadPlacementItems } from "./load-placement-state";

/** Sessions grade quick questions on the spot; typed confirmation stays in placement itself. */
const SESSION_FORMATS = new Set<ItemFormat>(["multipleChoice", "trueFalse"]);

/**
 * Undecided skills taken in turn from each phase and area (an exam's subjects, say), so a few
 * questions reach every start placement is unsure of instead of settling one area first.
 */
function interleaveByStart<TSkill extends { phase: number; sectionTitle: string | null }>(
  skills: readonly TSkill[],
): TSkill[] {
  return interleave([
    ...Map.groupBy(skills, (skill) => JSON.stringify([skill.phase, skill.sectionTitle])).values(),
  ]);
}

/**
 * Up to `limit` quick questions (multiple choice or true or false) a session can ask about skills
 * placement hasn't settled: unseen, one per skill (in the goal's quick format when it has one),
 * taken in turn from each phase and area whose starting point isn't confident yet. Empty once
 * every start is settled.
 */
export async function pickSessionPlacementItems({
  examBlueprintId,
  excludeItemIds,
  limit,
  quickFormat,
  skills,
  userId,
}: {
  /** The goal's exam: another exam's questions are never asked. */
  examBlueprintId: string | null;
  excludeItemIds: ReadonlySet<string>;
  limit: number;
  quickFormat: PlacementQuickFormat;
  skills: GoalPlan["skills"];
  userId: string;
}): Promise<string[]> {
  const skillIds = skills.map((skill) => skill.id);

  const [{ evidence, seenItemIds }, bankItems] = await Promise.all([
    loadEvidence({ skillIds, userId }),
    loadPlacementItems({ examBlueprintId, skillIds }),
  ]);

  const undecided = getUndecidedSkills({
    beliefs: getPlacementBeliefs({ evidence, skills }),
    skills,
  });

  const askable = bankItems
    .filter(
      (item) =>
        SESSION_FORMATS.has(item.format) &&
        !seenItemIds.has(item.id) &&
        !excludeItemIds.has(item.id),
    )
    .toSorted((a, b) => compareQuickFormat({ a: a.format, b: b.format, quickFormat }));

  return interleaveByStart(undecided)
    .flatMap((skill) => askable.find((item) => item.skillId === skill.id) ?? [])
    .slice(0, limit)
    .map((item) => item.id);
}
