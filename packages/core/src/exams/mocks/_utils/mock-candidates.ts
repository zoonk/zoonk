import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { fitsExamChoice, getExamChoiceFormat } from "../../../library/exams/exam-choice-format";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type MockCandidate } from "../mock-plan";

/** Fewer exam questions than this and the goal's own questions stand in for the exam's. */
const MIN_EXAM_ITEMS = 5;

type AreaPlanItem = Pick<PlanItem, "chapterId" | "lessonId" | "skillId">;

/**
 * Each lesson's area: the area of the graph skill its plan item teaches, or, for a lesson item
 * without one, the area its chapter's other lessons have.
 */
function getLessonAreas({
  graphAreas,
  items,
}: {
  graphAreas: ReadonlyMap<string, string>;
  items: readonly AreaPlanItem[];
}): Map<string, string> {
  const areaOf = (item: AreaPlanItem) => (item.skillId ? graphAreas.get(item.skillId) : undefined);

  const chapterAreas = new Map(
    items.flatMap((item) => {
      const area = areaOf(item);
      return item.chapterId && area ? [[item.chapterId, area] as const] : [];
    }),
  );

  return new Map(
    items.flatMap((item) => {
      const area = areaOf(item) ?? (item.chapterId ? chapterAreas.get(item.chapterId) : undefined);
      return item.lessonId && area ? [[item.lessonId, area] as const] : [];
    }),
  );
}

/**
 * Each goal skill's exam area, as the plan's graph names it ("Math", "Natural Sciences"). The
 * graph lists the plan's skills; the skills its lessons teach take the area of the plan item
 * that schedules the lesson, so a mock knows the area of every question it may ask.
 */
export async function loadSkillAreas(goalId: string): Promise<Map<string, string>> {
  const plan = await prisma.plan.findUnique({
    select: { graph: true, items: { select: { chapterId: true, lessonId: true, skillId: true } } },
    where: { goalId },
  });

  const graphAreas = new Map(
    parsePlanGraph(plan?.graph).skills.flatMap((skill) =>
      skill.area ? [[skill.skillId, skill.area] as const] : [],
    ),
  );

  const lessonAreas = getLessonAreas({ graphAreas, items: plan?.items ?? [] });

  const lessonSkills = await prisma.lessonSkill.findMany({
    orderBy: { createdAt: "asc" },
    where: { lessonId: { in: [...lessonAreas.keys()] } },
  });

  const taughtAreas = lessonSkills.flatMap((row) => {
    const area = lessonAreas.get(row.lessonId);
    return area ? [[row.skillId, area] as const] : [];
  });

  // A graph skill keeps its own area; a skill several lessons teach takes the first one's.
  return new Map([...taughtAreas.toReversed(), ...graphAreas]);
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
 * enough) that the learner has never answered, since repeats would inflate the score, in the
 * exam's own choice format with its number of options (ENEM never asks four options). With
 * `itemIds`, only those questions, to rebuild the sections of a mock already picked.
 */
export async function loadMockCandidates({
  goal,
  itemIds,
  skillIds,
  structure = null,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  itemIds: readonly string[] | null;
  skillIds: readonly string[];
  /** The exam the mock copies, whose choice format its questions follow. */
  structure?: ExamStructure | null;
  userId: string;
}): Promise<MockCandidate[]> {
  const [loaded, areas] = await Promise.all([
    loadItems({ examBlueprintId: goal.examBlueprintId, itemIds, skillIds }),
    goal.id ? loadSkillAreas(goal.id) : new Map<string, string>(),
  ]);

  const choice = getExamChoiceFormat(structure);
  const items = itemIds ? loaded : loaded.filter((item) => fitsExamChoice({ choice, item }));

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
