import "server-only";
import { prisma } from "@zoonk/db";
import { type SeededToday } from "@zoonk/db/seed/v2";
import { loadDayPlanVersion } from "../sessions/_utils/day-plan-version";
import { loadSessionBuildInput } from "../sessions/_utils/load-build-inputs";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";
import { gradeSessionAnswer, parseSessionItem } from "../sessions/_utils/session-items";
import { getBlockItemIds } from "../sessions/block-payload";
import { loadDayMissionFacts } from "../sessions/missions/day-facts";
import { pickMissions } from "../sessions/missions/pick-missions";
import { type PlannedBlock, buildSessionBlocks } from "../sessions/session-builder";

type BankItem = Parameters<typeof parseSessionItem>[0];

function toRightAnswer({ blockId, item }: { blockId: string; item: BankItem }) {
  const question = parseSessionItem(item);

  if (!question) {
    return [];
  }

  const { correctAnswer } = gradeSessionAnswer({
    answer: { dontKnow: true },
    blockId,
    item: question,
  });

  return [{ answer: correctAnswer, itemId: item.id, skillId: item.skillId }];
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
        return item ? toRightAnswer({ blockId: today.blockId(position), item }) : [];
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

  const planVersion = await loadDayPlanVersion(day);
  const input = await loadSessionBuildInput(day);
  const { blocks, plannedMinutes } = buildSessionBlocks(input);

  const [answers, facts] = await Promise.all([
    loadRightAnswers({ blocks, today }),
    loadDayMissionFacts({ ...day, blocks, plannedMinutes }),
  ]);

  const finished = await today.write({
    answers,
    blocks,
    freshStart: input.freshStart,
    missions: { picks: pickMissions(facts), version: 1 },
    planVersion,
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
