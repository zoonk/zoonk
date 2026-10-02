import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { daysBetween } from "../../../plans/planner/plan-calendar";
import { type PlannedProduce } from "../produce-block";

/** Days between essays: practice returns often enough to improve, not every day. */
const DAYS_BETWEEN_ESSAYS = 3;

async function wroteRecently({
  itemIds,
  today,
  userId,
}: {
  itemIds: string[];
  today: Date;
  userId: string;
}): Promise<{ recent: boolean; written: Map<string, Date> }> {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { answeredAt: true, itemId: true, localDate: true },
    where: { itemId: { in: itemIds }, userId },
  });

  const last = attempts[0]?.localDate;
  const since = last ? daysBetween(last, today) : null;

  const written = new Map(
    attempts
      .toReversed()
      .flatMap((attempt) =>
        attempt.itemId ? [[attempt.itemId, attempt.answeredAt] as const] : [],
      ),
  );

  return { recent: since !== null && since < DAYS_BETWEEN_ESSAYS, written };
}

/**
 * The day's essay for an exam that has written answers: an essay question on the goal's skills
 * (the exam's own first), the one written longest ago or never, every few days. An exam has them
 * when its blueprint lists essays or free-response questions were written for it (AP). Null for
 * other goals, exams without written answers, and days too close to the last essay.
 */
export async function loadSessionProduce({
  goal,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}): Promise<PlannedProduce | null> {
  if (goal.kind !== "exam") {
    return null;
  }

  const items = await prisma.item.findMany({
    include: { skill: { select: { name: true } } },
    orderBy: { id: "asc" },
    where: {
      format: "essay",
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({ examBlueprintId: goal.examBlueprintId }),
    },
  });

  const hasEssay =
    (structure?.formats.some((format) => format.kind === "essay") ?? false) ||
    items.some(
      (item) => item.examBlueprintId !== null && item.examBlueprintId === goal.examBlueprintId,
    );

  if (!hasEssay) {
    return null;
  }

  const { recent, written } = await wroteRecently({
    itemIds: items.map((item) => item.id),
    today,
    userId,
  });

  const [item] = (recent ? [] : items).toSorted(
    (first, second) =>
      Number(second.examBlueprintId === goal.examBlueprintId) -
        Number(first.examBlueprintId === goal.examBlueprintId) ||
      (written.get(first.id)?.getTime() ?? 0) - (written.get(second.id)?.getTime() ?? 0),
  );

  return item ? { itemId: item.id, skillId: item.skillId, title: item.skill.name } : null;
}
