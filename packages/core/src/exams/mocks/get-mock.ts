import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getMovableDay, loadChallengeMoveRules } from "../../checkpoints/_utils/challenge-move";
import { EXAM_DAY_CHECKLIST } from "../../checkpoints/weekly-challenge-rules";
import { toQuestionView } from "../../learner/_utils/choice-items";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS } from "../../sessions/brain-power";
import { loadMockPlanOffers } from "./_utils/mock-adapt";
import { loadSkillAreas } from "./_utils/mock-candidates";
import { buildMockConditions } from "./_utils/mock-conditions";
import { loadMockItems } from "./_utils/mock-items";
import { countFinishedMocksBefore } from "./_utils/mock-number";
import { loadMockReview } from "./_utils/mock-review";
import { getFirstNumber, toSectionViews } from "./_utils/mock-sections";
import {
  type MockSitting,
  type OwnedMock,
  findOwnedMock,
  getSectionDeadline,
} from "./_utils/owned-mock";
import {
  type MockConditions,
  type MockView,
  mockResultSchema,
  readMockChoice,
} from "./mock-contract";

export type MockViewResult =
  | { mock: MockView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** This mock's place among the goal's mocks: "Mock exam 3". */
async function getMockNumber(owned: OwnedMock): Promise<number> {
  const earlier = await countFinishedMocksBefore({
    createdAt: owned.mock?.createdAt,
    goalId: owned.goal?.id ?? null,
  });

  return earlier + 1;
}

async function loadCurrentSection({
  areas,
  mock,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
}): Promise<MockView["current"]> {
  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section) {
    return null;
  }

  const items = await loadMockItems(section.itemIds);
  const first = getFirstNumber({ conditions: mock.conditions, section: mock.sectionIndex });

  const questions = section.itemIds.flatMap((itemId, index) => {
    const item = items.get(itemId);

    return item
      ? [{ ...toQuestionView(item), area: areas.get(item.skillId) ?? null, number: first + index }]
      : [];
  });

  const drafts = mock.answers
    .filter((answer) => section.itemIds.includes(answer.itemId))
    .map((answer) => ({
      answer: readMockChoice(answer.answer),
      durationMs: answer.durationMs,
      flagged: answer.flagged,
      itemId: answer.itemId,
    }));

  return {
    deadline: getSectionDeadline(mock).toISOString(),
    drafts,
    questions,
    section: mock.sectionIndex,
  };
}

/** "Move to Monday" before the mock starts, from its own day or a later one. */
async function canMoveMock(owned: OwnedMock): Promise<boolean> {
  const { block, goal, mock, payload } = owned;

  if (mock || block?.status !== "pending" || !goal || !payload.planItemId) {
    return false;
  }

  const [item, rules] = await Promise.all([
    isUuid(payload.planItemId)
      ? prisma.planItem.findUnique({ where: { id: payload.planItemId } })
      : null,
    loadChallengeMoveRules(goal.id),
  ]);

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  return getMovableDay({ item, rules, today }) !== null;
}

function getStatus(mock: MockSitting | null): MockView["status"] {
  if (!mock) {
    return "ready";
  }

  return mock.status === "finished" ? "finished" : "running";
}

async function loadFinished({
  areas,
  conditions,
  owned,
}: {
  areas: Map<string, string>;
  conditions: MockConditions;
  owned: OwnedMock;
}) {
  if (owned.mock?.status !== "finished") {
    return { adapt: null, mistakes: [], result: null, review: [] };
  }

  const result = mockResultSchema.safeParse(owned.mock.result).data ?? null;

  const [review, offers] = await Promise.all([
    loadMockReview({ areas, conditions, mockExamId: owned.mock.id, userId: owned.userId }),
    loadMockPlanOffers({ goal: owned.goal, purpose: conditions.purpose, result }),
  ]);

  return { ...review, adapt: offers?.view ?? null, result };
}

/** Where the mock belongs: its goal and exam, and the session it was played in, if any. */
function describeOwner(owned: OwnedMock) {
  return {
    date: toIsoDate(owned.sessionDate),
    examName: owned.blueprint?.name ?? owned.goal?.title ?? null,
    goalId: owned.goal?.id ?? null,
    scoringNote: owned.structure?.mock?.scoring.description ?? null,
    sessionId: owned.block?.sessionId ?? null,
    trueFalseLabels: getTrueFalseLabels(owned.structure),
  };
}

/**
 * One of the learner's mock exams, by the id it opens by (its session block's, or its own for a
 * mock taken any time): the exam's conditions before it starts, the running section with its
 * deadline and drafts (never the answers), and after it, what it showed with the questions to
 * review.
 */
export async function getMock(blockId: string): Promise<MockViewResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;
  const { mock } = owned;
  const conditions = mock?.conditions ?? (await buildMockConditions(owned));
  const areas = owned.goal ? await loadSkillAreas(owned.goal.id) : new Map<string, string>();
  const running = mock?.status === "active" ? mock : null;

  const [number, current, finished, canMove] = await Promise.all([
    getMockNumber(owned),
    running ? loadCurrentSection({ areas, mock: running }) : null,
    loadFinished({ areas, conditions, owned }),
    canMoveMock(owned),
  ]);

  return {
    mock: {
      ...describeOwner(owned),
      adapt: finished.adapt,
      blockId,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      canMove,
      checklist: [...EXAM_DAY_CHECKLIST],
      current,
      fullLength: conditions.fullLength,
      minutes: conditions.sections.reduce((sum, section) => sum + section.minutes, 0),
      mistakes: finished.mistakes,
      number,
      planItemId: owned.payload.planItemId,
      purpose: conditions.purpose,
      questions: conditions.sections.reduce((sum, section) => sum + section.questions, 0),
      result: finished.result,
      review: finished.review,
      scoring: conditions.scoring,
      sections: toSectionViews({
        conditions,
        current: running ? running.sectionIndex : null,
        finished: mock?.status === "finished",
      }),
      shape: conditions.shape,
      startTime: conditions.startTime,
      status: getStatus(mock),
      timeZone: conditions.timeZone,
    },
    status: "ready",
  };
}
