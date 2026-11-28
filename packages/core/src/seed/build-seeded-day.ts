import "server-only";
import { prisma } from "@zoonk/db";
import { type SeededToday } from "@zoonk/db/seed";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";
import { planStudyDay } from "../sessions/_utils/plan-study-day";
import { getStudyAnswerEvidence } from "../sessions/_utils/record-study-answer";
import { readSavedDayPlan } from "../sessions/_utils/saved-day-plan";
import { gradeSessionAnswer, parseSessionItem } from "../sessions/_utils/session-items";
import { getBlockItemIds } from "../sessions/block-payload";
import { type PlannedBlock } from "../sessions/session-builder";

type BankItem = Parameters<typeof parseSessionItem>[0];

function toRightAnswer({
  blockId,
  item,
  placement,
}: {
  blockId: string;
  item: BankItem;
  placement: boolean;
}) {
  const question = parseSessionItem(item);

  if (!question) {
    return [];
  }

  const { correctAnswer } = gradeSessionAnswer({
    answer: { dontKnow: true },
    blockId,
    item: question,
  });

  return [
    {
      answer: correctAnswer,
      evidence: getStudyAnswerEvidence({ blank: false, placement }),
      itemId: item.id,
      skillId: item.skillId,
    },
  ];
}

async function loadRightAnswers({
  blocks,
  today,
}: {
  blocks: readonly PlannedBlock[];
  today: SeededToday;
}) {
  const itemIds = blocks.flatMap((block) => getBlockItemIds(block.payload));
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const byId = new Map(items.map((item) => [item.id, item]));

  return new Map(
    blocks.map((block, position) => [
      position,
      getBlockItemIds(block.payload).flatMap((itemId) => {
        const item = byId.get(itemId);
        const placement = block.payload.placementItemIds.includes(itemId);
        return item ? toRightAnswer({ blockId: today.blockId(position), item, placement }) : [];
      }),
    ]),
  );
}

/** Seed tooling only; uses the session builder without model calls. */
export async function buildSeededDay({ goalId, today }: { goalId: string; today: SeededToday }) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  const day = {
    goal,
    localDate: today.localDate,
    now: today.now,
    timeZone: today.timeZone,
    userId: goal.userId,
  };

  const selection = await readSavedDayPlan(day);

  if (!selection) {
    return;
  }

  const { blocks, input, missions, plannedMinutes } = await planStudyDay({ ...day, selection });
  const answers = await loadRightAnswers({ blocks, today });

  const finished = await today.write({
    answers,
    blocks,
    freshStart: input.freshStart,
    missions,
    planVersion: selection.context.plan.version,
    plannedMinutes,
  });

  await Promise.all(
    finished.flatMap(({ completedAt, kind, lessonId }) =>
      kind === "learn" && lessonId
        ? [
            prisma.$transaction((tx) =>
              completeLessonPlanItems(tx, { lessonId, now: completedAt, userId: goal.userId }),
            ),
          ]
        : [],
    ),
  );
}
