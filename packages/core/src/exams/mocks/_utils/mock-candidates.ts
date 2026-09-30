import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type MockCandidate } from "../mock-plan";

/** Fewer exam questions than this and the goal's own questions stand in for the exam's. */
const MIN_EXAM_ITEMS = 5;

/** Each goal skill's exam area, as the plan's graph names it ("Math", "Natural Sciences"). */
export async function loadSkillAreas(goalId: string): Promise<Map<string, string>> {
  const plan = await prisma.plan.findUnique({ select: { graph: true }, where: { goalId } });

  return new Map(
    parsePlanGraph(plan?.graph).skills.flatMap((skill) =>
      skill.area ? [[skill.skillId, skill.area] as const] : [],
    ),
  );
}

async function loadItems({
  examBlueprintId,
  itemIds,
  skillIds,
}: {
  examBlueprintId: string | null;
  itemIds: readonly string[] | null;
  skillIds: readonly string[];
}) {
  const where = {
    format: { in: [...GRADABLE_ITEM_FORMATS] },
    ...(itemIds
      ? { id: { in: [...itemIds] } }
      : { skillId: { in: [...skillIds] }, ...getItemAudienceFilter({ examBlueprintId }) }),
  };

  const examItems =
    examBlueprintId && !itemIds
      ? await prisma.item.findMany({ orderBy: { id: "asc" }, where: { ...where, examBlueprintId } })
      : [];

  return examItems.length >= MIN_EXAM_ITEMS
    ? examItems
    : prisma.item.findMany({ orderBy: { id: "asc" }, where });
}

/**
 * Questions a mock may ask: choice questions on the goal's skills (the exam's own when it has
 * enough) that the learner has never answered, since repeats would inflate the score. With
 * `itemIds`, only those questions, to rebuild the sections of a mock already picked.
 */
export async function loadMockCandidates({
  goal,
  itemIds,
  skillIds,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  itemIds: readonly string[] | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<MockCandidate[]> {
  const [items, areas] = await Promise.all([
    loadItems({ examBlueprintId: goal.examBlueprintId, itemIds, skillIds }),
    goal.id ? loadSkillAreas(goal.id) : new Map<string, string>(),
  ]);

  const seen = itemIds
    ? []
    : await prisma.attempt.findMany({
        distinct: ["itemId"],
        select: { itemId: true },
        where: { itemId: { in: items.map((item) => item.id) }, userId },
      });

  const seenIds = new Set(seen.map((attempt) => attempt.itemId));

  return items
    .filter((item) => !seenIds.has(item.id))
    .map((item) => ({
      area: areas.get(item.skillId) ?? null,
      difficulty: item.difficulty,
      itemId: item.id,
      skillId: item.skillId,
    }));
}
