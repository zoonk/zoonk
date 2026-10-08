import "server-only";
import { prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { loadPreparationInputs } from "../../../preparation/_utils/load-preparation-inputs";
import {
  getPreparationComponents,
  getPreparationValue,
} from "../../../preparation/preparation-math";
import { finishStudyBlock } from "../../../sessions/finish-study-block";
import { type GradedMockAnswer, analyzeMock, getMockMeasure } from "../mock-analysis";
import {
  type MockConditions,
  type MockResult,
  mockConditionsSchema,
  mockResultSchema,
} from "../mock-contract";
import { gradeMock } from "./grade-mock";
import { loadSkillAreas } from "./mock-candidates";
import { getAskedItemIds } from "./mock-sections";
import { type MockSitting, type OwnedMock } from "./owned-mock";
import { settleAnytimeMock } from "./settle-anytime-mock";

const MS_PER_MINUTE = 60_000;

async function measurePreparation({ goalId, userId }: { goalId: string | null; userId: string }) {
  if (!goalId) {
    return null;
  }

  const now = new Date();
  const inputs = await loadPreparationInputs({ goalId, now, userId });

  return getPreparationValue(getPreparationComponents({ ...inputs, asOf: now }));
}

/** How many of the goal's latest mocks are looked through for one like this. */
const PREVIOUS_MOCKS_READ = 10;

/** Two mocks that measure the same thing: the same part of the exam, never a placement one. */
function isLike(mock: MockConditions, other: MockConditions): boolean {
  return (
    other.purpose !== "placement" &&
    other.scoring === mock.scoring &&
    JSON.stringify(other.shape) === JSON.stringify(mock.shape)
  );
}

/**
 * The goal's previous mock like this one in the same terms, for "+16 since the last one": the
 * plan's weekly mocks among themselves, a mock taken any time against the last of the same part of
 * the exam (a subject against that subject). A placement mock, stopped wherever the learner
 * wanted, is never the measure.
 */
async function loadPreviousMeasure(mock: MockSitting): Promise<number | null> {
  if (!mock.goalId || mock.conditions.purpose === "placement") {
    return null;
  }

  const previous = await prisma.mockExam.findMany({
    orderBy: { finishedAt: "desc" },
    select: { conditions: true, result: true },
    take: PREVIOUS_MOCKS_READ,
    where: { goalId: mock.goalId, id: { not: mock.id }, status: "finished" },
  });

  const like = previous.find((row) => {
    const conditions = mockConditionsSchema.safeParse(row.conditions).data;
    return conditions ? isLike(mock.conditions, conditions) : false;
  });

  const result = mockResultSchema.safeParse(like?.result).data;
  return result ? getMockMeasure(result) : null;
}

/**
 * The block keeps every question it reserved; an adaptive exam asks only one of a module's two
 * sets, so the block's questions become the ones asked before the session settles it.
 */
async function keepAskedQuestions({
  blockId,
  mock,
  owned,
}: {
  blockId: string;
  mock: MockSitting;
  owned: OwnedMock;
}) {
  const asked = getAskedItemIds(mock.conditions).map((entry) => entry.itemId);

  if (asked.length === owned.payload.itemIds.length) {
    return;
  }

  await prisma.studySessionBlock.update({
    data: { payload: { ...owned.payload, itemIds: asked } },
    where: { id: blockId },
  });
}

/**
 * Settles what the mock earned: a scheduled mock's session block (Brain Power, the ledger row that
 * feeds preparation, the plan item checked off), or a mock taken any time on its own.
 */
async function settleMock({
  graded,
  mock,
  owned,
  timeZone,
}: {
  graded: readonly GradedMockAnswer[];
  mock: MockSitting;
  owned: OwnedMock;
  timeZone: string;
}) {
  if (!owned.block) {
    await settleAnytimeMock({ graded, mock, timeZone });
    return;
  }

  await keepAskedQuestions({ blockId: owned.block.id, mock, owned });

  await finishStudyBlock({
    blockId: owned.block.id,
    input: { timeZone },
    sessionId: owned.block.sessionId,
  });
}

async function trackCompletion({
  graded,
  mock,
  result,
}: {
  graded: readonly GradedMockAnswer[];
  mock: MockSitting;
  result: MockResult;
}) {
  await trackLearnerEvents({
    events: [
      {
        name: "Mock Exam Completed",
        properties: {
          correct: result.correct,
          exam_blueprint_id: mock.examBlueprintId,
          minutes: Math.round(result.minutesUsed),
          questions: graded.length,
        },
      },
    ],
    goalId: mock.goalId,
    userId: mock.userId,
  });
}

/**
 * Ends a mock: grades and records every answer, settles what it earned (see `settleMock`), then
 * keeps what it showed.
 */
export async function completeMock({
  mock,
  owned,
  timeZone,
}: {
  mock: MockSitting;
  owned: OwnedMock;
  timeZone: string;
}): Promise<MockResult> {
  const areas = mock.goalId ? await loadSkillAreas(mock.goalId) : new Map<string, string>();

  const [before, previous] = await Promise.all([
    measurePreparation({ goalId: mock.goalId, userId: mock.userId }),
    loadPreviousMeasure(mock),
  ]);

  const graded = await gradeMock({
    areas,
    mock,
    sessionId: owned.block?.sessionId ?? null,
    timeZone,
  });

  await settleMock({ graded, mock, owned, timeZone });

  const after = await measurePreparation({ goalId: mock.goalId, userId: mock.userId });
  const spentMs = graded.reduce((sum, answer) => sum + answer.durationMs, 0);

  const result = analyzeMock({
    answers: graded,
    conditions: mock.conditions,
    minutesUsed: Math.round(spentMs / MS_PER_MINUTE),
    preparation: before === null || after === null ? null : { after, before },
    previous,
  });

  await prisma.mockExam.update({
    data: { finishedAt: new Date(), result, status: "finished" },
    where: { id: mock.id },
  });

  revalidateCacheTags([getLearnerModelCacheTag(mock.userId)]);
  await trackCompletion({ graded, mock, result });

  return result;
}
