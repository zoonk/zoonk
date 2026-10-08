import "server-only";
import { type Goal, type ItemFormat, prisma } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getPlacementBeliefs } from "../placement-beliefs";
import { getKnownSubjects, getOwnLevel } from "../placement-contract";
import { isOwnMaterialTest } from "../placement-material";
import { type PlacementQuickFormat, compareQuickFormat } from "../placement-quick-format";
import { getUndecidedSkills } from "../placement-steps";
import { loadEvidence } from "./load-placement-state";
import { loadPlacementItems } from "./placement-bank-items";

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
  excludeItemIds,
  goal,
  limit,
  quickFormat,
  skills,
  userId,
}: {
  excludeItemIds: ReadonlySet<string>;
  /**
   * The goal: its exam's questions only (never another exam's), and the level and subjects the
   * learner gave, which settle the easier bands before any answer.
   */
  goal: Pick<Goal, "details" | "examBlueprintId">;
  limit: number;
  quickFormat: PlacementQuickFormat;
  skills: GoalPlan["skills"];
  userId: string;
}): Promise<string[]> {
  const skillIds = skills.map((skill) => skill.id);

  const [{ evidence, seenItemIds }, bankItems, blueprint] = await Promise.all([
    loadEvidence({ skillIds, userId }),
    loadPlacementItems({ examBlueprintId: goal.examBlueprintId, skillIds }),
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({
          select: { ownerId: true },
          where: { id: goal.examBlueprintId },
        })
      : null,
  ]);

  const answeredOnly = isOwnMaterialTest(blueprint);

  const undecided = getUndecidedSkills({
    answeredOnly,
    beliefs: getPlacementBeliefs({
      answeredOnly,
      evidence,
      knownAreas: getKnownSubjects(goal),
      ownLevel: getOwnLevel({ goal }),
      skills,
    }),
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
