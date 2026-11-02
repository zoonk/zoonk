import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { readBlockPayload } from "../../../sessions/block-payload";
import { loadDoneUnitIds } from "../../units/can-do-events";
import { type LanguageUnit, findCurrentUnit, loadLanguageUnits } from "../../units/language-units";

async function findLearnerUnit({ goal, units }: { goal: Goal; units: LanguageUnit[] }) {
  const doneIds = await loadDoneUnitIds({ units, userId: goal.userId });
  return findCurrentUnit({ doneIds, units });
}

export async function findCheckpointUnit({
  goal,
  planItemId,
}: {
  goal: Goal;
  planItemId: string | null;
}): Promise<LanguageUnit | null> {
  const units = await loadLanguageUnits(goal);
  const item = planItemId ? await prisma.planItem.findUnique({ where: { id: planItemId } }) : null;

  if (!item) {
    return findLearnerUnit({ goal, units });
  }

  const phaseItems = await prisma.planItem.findMany({
    select: { chapterId: true, lessonId: true },
    where: { phase: item.phase, planId: item.planId },
  });

  const lessonIds = new Set(phaseItems.flatMap((row) => row.lessonId ?? []));
  const chapterIds = new Set(phaseItems.flatMap((row) => row.chapterId ?? []));

  const planned = units.filter(
    (unit) =>
      chapterIds.has(unit.chapterId) ||
      unit.lessons.some((lesson) => lessonIds.has(lesson.lessonId)),
  );

  return planned.at(-1) ?? findLearnerUnit({ goal, units });
}

export async function findLanguageCheckpointBlock({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}): Promise<
  { goal: Goal; status: "ready"; unit: LanguageUnit } | { status: "notFound" | "notLanguage" }
> {
  const block = await prisma.studySessionBlock.findFirst({
    include: { session: { include: { goal: true } } },
    where: { id: blockId, kind: "checkpoint", session: { userId } },
  });

  if (!block) {
    return { status: "notFound" };
  }

  const goal = block.session.goal;
  const payload = readBlockPayload(block);

  if (goal?.kind !== "language" || payload.checkpoint?.kind === "weekly") {
    return { status: "notLanguage" };
  }

  const unit = await findCheckpointUnit({ goal, planItemId: payload.planItemId });
  return unit ? { goal, status: "ready", unit } : { status: "notLanguage" };
}

export function toCheckpointScenarioUnit({
  goal,
  targetLanguage,
  unit,
}: {
  goal: Goal;
  targetLanguage: string;
  unit: LanguageUnit;
}) {
  return { ...unit, id: unit.chapterId, language: goal.language, targetLanguage };
}
