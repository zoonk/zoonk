import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { readBlockPayload } from "../../../sessions/block-payload";
import { loadDoneUnitIds } from "../../units/can-do-events";
import { type LanguageUnit, findCurrentUnit, loadLanguageUnits } from "../../units/language-units";

/** The unit the learner is in, as Today and Progress show it. */
async function findLearnerUnit({ goal, units }: { goal: Goal; units: LanguageUnit[] }) {
  const doneIds = await loadDoneUnitIds({ units, userId: goal.userId });
  return findCurrentUnit({ doneIds, units });
}

/**
 * The unit a checkpoint closes: the one holding the lessons planned in the checkpoint's phase, or
 * the learner's current unit when the phase has none of the course's lessons.
 */
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

/**
 * The language goal of one of the learner's checkpoint blocks and the unit it closes: a language
 * goal's boss is a conversation that closes a unit, not a duel of questions. Null for anything else.
 */
export async function findLanguageCheckpointBlock({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}): Promise<{ goal: Goal; unit: LanguageUnit } | null> {
  const block = await prisma.studySessionBlock.findFirst({
    include: { session: { include: { goal: true } } },
    where: { id: blockId, kind: "checkpoint", session: { userId } },
  });

  const goal = block?.session.goal;

  if (!block || goal?.kind !== "language") {
    return null;
  }

  const payload = readBlockPayload(block);

  if (payload.checkpoint?.kind === "weekly") {
    return null;
  }

  const unit = await findCheckpointUnit({ goal, planItemId: payload.planItemId });
  return unit ? { goal, unit } : null;
}

/** What a checkpoint's call is written from: the unit it closes, in the goal's two languages. */
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
