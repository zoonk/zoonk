import "server-only";
import { prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { loadSkillsToRelearn } from "../../../learner/_utils/load-skill-claims";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { bringBackMissedLessons } from "../../../plans/bring-back-missed-lessons";
import { loadPreparationInputs } from "../../../preparation/_utils/load-preparation-inputs";
import { measurePreparation } from "../../../preparation/section-preparation";
import { readBlockPayload } from "../../../sessions/block-payload";
import { finishStudyBlock } from "../../../sessions/finish-study-block";
import { NOTHING_REACHED, type Reached, getReached } from "../../../sessions/reached";
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

async function measureGoalPreparation({
  goalId,
  userId,
}: {
  goalId: string | null;
  userId: string;
}) {
  if (!goalId) {
    return null;
  }

  const now = new Date();
  const inputs = await loadPreparationInputs({ goalId, now, userId });

  return measurePreparation({ ...inputs, asOf: now }).value;
}

async function loadMockSkillsToRelearn(mock: MockSitting): Promise<Set<string>> {
  if (!mock.goalId) {
    return new Set();
  }

  const asked = await prisma.item.findMany({
    select: { skillId: true },
    where: { id: { in: getAskedItemIds(mock.conditions).map((entry) => entry.itemId) } },
  });

  return loadSkillsToRelearn({
    goalId: mock.goalId,
    skillIds: [...new Set(asked.map((item) => item.skillId))],
    userId: mock.userId,
  });
}

const PREVIOUS_MOCKS_READ = 10;

function isLike(mock: MockConditions, other: MockConditions): boolean {
  return (
    other.purpose !== "placement" &&
    other.scoring === mock.scoring &&
    JSON.stringify(other.shape) === JSON.stringify(mock.shape)
  );
}

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

async function keepAskedQuestions({ blockId, mock }: { blockId: string; mock: MockSitting }) {
  const asked = getAskedItemIds(mock.conditions).map((entry) => entry.itemId);

  await writeLearnerChange({ userId: mock.userId }, async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM study_session_blocks WHERE id = ${blockId}::uuid FOR UPDATE
    `;

    const block = await tx.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    const payload = readBlockPayload(block);

    if (asked.length === payload.itemIds.length) {
      return unchanged(null);
    }

    await tx.studySessionBlock.update({
      data: { payload: { ...payload, itemIds: asked } },
      where: { id: blockId },
    });

    return null;
  });
}

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
}): Promise<Reached> {
  if (!owned.block) {
    const progress = await settleAnytimeMock({ graded, mock, timeZone });
    return progress ? getReached(progress) : NOTHING_REACHED;
  }

  await keepAskedQuestions({ blockId: owned.block.id, mock });

  const finished = await finishStudyBlock({
    blockId: owned.block.id,
    input: { timeZone },
    sessionId: owned.block.sessionId,
  });

  return finished.status === "ready" ? finished.completion.reached : NOTHING_REACHED;
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

  const [before, previous, toRelearn] = await Promise.all([
    measureGoalPreparation({ goalId: mock.goalId, userId: mock.userId }),
    loadPreviousMeasure(mock),
    loadMockSkillsToRelearn(mock),
  ]);

  const graded = await gradeMock({
    areas,
    mock,
    practicedLanguage: owned.goal?.targetLanguage ?? null,
    sessionId: owned.block?.sessionId ?? null,
    timeZone,
  });

  const reached = await settleMock({ graded, mock, owned, timeZone });

  if (mock.goalId) {
    await bringBackMissedLessons({
      goalId: mock.goalId,
      now: new Date(),
      skillIds: graded.flatMap((answer) =>
        answer.outcome !== "right" && toRelearn.has(answer.skill.id) ? [answer.skill.id] : [],
      ),
      timeZone,
    });
  }

  const after = await measureGoalPreparation({ goalId: mock.goalId, userId: mock.userId });
  const spentMs = graded.reduce((sum, answer) => sum + answer.durationMs, 0);

  const result = analyzeMock({
    answers: graded,
    conditions: mock.conditions,
    minutesUsed: Math.round(spentMs / MS_PER_MINUTE),
    preparation: before === null || after === null ? null : { after, before },
    previous,
  });

  const finished = await writeLearnerChange({ userId: mock.userId }, async (tx) => {
    const { count } = await tx.mockExam.updateMany({
      data: { finishedAt: new Date(), result: { ...result, reached }, status: "finished" },
      where: { id: mock.id, status: "active" },
    });

    return count > 0 ? count : unchanged(count);
  });

  if (finished > 0) {
    revalidateCacheTags([getLearnerModelCacheTag(mock.userId)]);
    await trackCompletion({ graded, mock, result });
  }

  return result;
}
