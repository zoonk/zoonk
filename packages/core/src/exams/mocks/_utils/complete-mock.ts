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
import { type MockResult, mockResultSchema } from "../mock-contract";
import { gradeMock } from "./grade-mock";
import { loadSkillAreas } from "./mock-candidates";
import { getAskedItemIds } from "./mock-sections";
import { type MockSitting, type OwnedMock } from "./owned-mock";

const MS_PER_MINUTE = 60_000;

async function measurePreparation({ goalId, userId }: { goalId: string | null; userId: string }) {
  if (!goalId) {
    return null;
  }

  const now = new Date();
  const inputs = await loadPreparationInputs({ goalId, now, userId });

  return getPreparationValue(getPreparationComponents({ ...inputs, asOf: now }));
}

/** The goal's previous mock in the same terms, for "+16 since the last one". */
async function loadPreviousMeasure(mock: MockSitting): Promise<number | null> {
  if (!mock.goalId) {
    return null;
  }

  const previous = await prisma.mockExam.findFirst({
    orderBy: { finishedAt: "desc" },
    select: { result: true },
    where: { goalId: mock.goalId, id: { not: mock.id }, status: "finished" },
  });

  const result = mockResultSchema.safeParse(previous?.result).data;
  return result && result.scoring === mock.conditions.scoring ? getMockMeasure(result) : null;
}

/**
 * The block keeps every question it reserved; an adaptive exam asks only one of a module's two
 * sets, so the block's questions become the ones asked before the session settles it.
 */
async function keepAskedQuestions(owned: OwnedMock, mock: MockSitting) {
  const asked = getAskedItemIds(mock.conditions).map((entry) => entry.itemId);

  if (asked.length === owned.payload.itemIds.length) {
    return;
  }

  await prisma.studySessionBlock.update({
    data: { payload: { ...owned.payload, itemIds: asked } },
    where: { id: owned.block.id },
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
 * Ends a mock: grades and records every answer, settles its session block (Brain Power, the
 * mock's ledger row that feeds preparation, the plan item checked off), then keeps what it showed.
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

  const graded = await gradeMock({ areas, mock, sessionId: owned.block.sessionId, timeZone });

  await keepAskedQuestions(owned, mock);

  await finishStudyBlock({
    blockId: owned.block.id,
    input: { timeZone },
    sessionId: owned.block.sessionId,
  });

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
