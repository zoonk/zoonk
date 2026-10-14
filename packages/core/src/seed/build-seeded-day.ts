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

/** A question the persona answered in a block, as the session's grading reads it. */
type BankItem = Parameters<typeof parseSessionItem>[0];

/** The right answer to a block's question, in the shape the session records answers in. */
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

/** Right answers to each block's questions, by its position: what a finished block was answered. */
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

/**
 * Builds a persona's today the way the app does when the learner opens Today (see
 * `ensureStudySession`), from the plan the seed just made, as of the moment the seed writes the
 * persona on, with the missions the app picks for it. The seed then stores how far the persona got
 * through it, the blocks it finished answered right, and each lesson it finished is checked off in
 * the plan as finishing its block does. No model is called.
 */
export async function buildSeededDay({ goalId, today }: { goalId: string; today: SeededToday }) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  const day = {
    goal,
    localDate: today.localDate,
    now: today.now,
    timeZone: today.timeZone,
    userId: goal.userId,
  };

  // Read before the day is built from the plan, as the app does.
  const planVersion = await loadDayPlanVersion(day);
  const input = await loadSessionBuildInput(day);
  const { blocks, plannedMinutes } = buildSessionBlocks(input);

  // The day's missions are picked and stored with it, so the frame reads them as it reads any day's.
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
