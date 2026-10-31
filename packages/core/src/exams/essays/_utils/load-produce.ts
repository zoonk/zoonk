import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { daysBetween, fromIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import {
  type WrittenSchedule,
  getDaysBetweenEssays,
  isWrittenDay,
} from "../../../plans/planner/written-cadence";
import { type PlannedProduce, getEssayMinutes } from "../produce-block";

function getWrittenSchedule({
  planSettings,
  targetDate,
  today,
}: {
  planSettings: unknown;
  targetDate: Date | null;
  today: Date;
}): WrittenSchedule {
  const settings = parsePlanSettings(planSettings);

  return {
    cadence: settings.writtenCadence,
    planStart: settings.startDate ? fromIsoDate(settings.startDate) : today,
    targetDate,
  };
}

async function wroteRecently({
  itemIds,
  schedule,
  today,
  userId,
}: {
  itemIds: string[];
  schedule: WrittenSchedule;
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

  return { recent: since !== null && since < getDaysBetweenEssays(schedule), written };
}

export async function loadSessionProduce({
  goal,
  planSettings,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetDate">;
  planSettings: unknown;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}): Promise<PlannedProduce | null> {
  const schedule = getWrittenSchedule({ planSettings, targetDate: goal.targetDate, today });

  if (goal.kind !== "exam" || !isWrittenDay({ ...schedule, date: today })) {
    return null;
  }

  const [items, blueprint] = await Promise.all([
    prisma.item.findMany({
      include: { skill: { select: { name: true } } },
      orderBy: { id: "asc" },
      where: {
        format: "essay",
        skillId: { in: [...skillIds] },
        ...getItemAudienceFilter({ examBlueprintId: goal.examBlueprintId }),
      },
    }),
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({
          select: { ownerId: true },
          where: { id: goal.examBlueprintId },
        })
      : null,
  ]);

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
    schedule,
    today,
    userId,
  });

  const [item] = (recent ? [] : items).toSorted(
    (first, second) =>
      Number(second.examBlueprintId === goal.examBlueprintId) -
        Number(first.examBlueprintId === goal.examBlueprintId) ||
      (written.get(first.id)?.getTime() ?? 0) - (written.get(second.id)?.getTime() ?? 0),
  );

  const minutes = getEssayMinutes({ classTest: Boolean(blueprint?.ownerId) });

  return item ? { itemId: item.id, minutes, skillId: item.skillId, title: item.skill.name } : null;
}
