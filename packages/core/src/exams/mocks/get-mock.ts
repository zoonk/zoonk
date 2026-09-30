import "server-only";
import { EXAM_DAY_CHECKLIST } from "../../checkpoints/weekly-challenge-rules";
import { toQuestionView } from "../../learner/_utils/choice-items";
import { getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS } from "../../sessions/brain-power";
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
    return { mistakes: [], result: null, review: [] };
  }

  const review = await loadMockReview({
    areas,
    conditions,
    sessionId: owned.block.sessionId,
    userId: owned.userId,
  });

  return { ...review, result: mockResultSchema.safeParse(owned.mock.result).data ?? null };
}

/**
 * One of the learner's mock exams, by its session block: the exam's conditions before it starts,
 * the running section with its deadline and drafts (never the answers), and after it, what it
 * showed with the questions to review.
 */
export async function getMock(blockId: string): Promise<MockViewResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;
  const { block, mock, structure } = owned;
  const conditions = mock?.conditions ?? (await buildMockConditions(owned));
  const areas = owned.goal ? await loadSkillAreas(owned.goal.id) : new Map<string, string>();
  const running = mock?.status === "active" ? mock : null;

  const [number, current, finished] = await Promise.all([
    getMockNumber(owned),
    running ? loadCurrentSection({ areas, mock: running }) : null,
    loadFinished({ areas, conditions, owned }),
  ]);

  return {
    mock: {
      blockId,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      canMove: !mock && block.status === "pending",
      checklist: [...EXAM_DAY_CHECKLIST],
      current,
      date: toIsoDate(owned.sessionDate),
      examName: owned.blueprint?.name ?? owned.goal?.title ?? null,
      fullLength: conditions.fullLength,
      goalId: owned.goal?.id ?? null,
      minutes: conditions.sections.reduce((sum, section) => sum + section.minutes, 0),
      mistakes: finished.mistakes,
      number,
      questions: conditions.sections.reduce((sum, section) => sum + section.questions, 0),
      result: finished.result,
      review: finished.review,
      scoring: conditions.scoring,
      scoringNote: structure?.mock?.scoring.description ?? null,
      sections: toSectionViews({
        conditions,
        current: running ? running.sectionIndex : null,
        finished: mock?.status === "finished",
      }),
      sessionId: block.sessionId,
      startTime: conditions.startTime,
      status: getStatus(mock),
      timeZone: conditions.timeZone,
      trueFalseLabels: getTrueFalseLabels(structure),
    },
    status: "ready",
  };
}
