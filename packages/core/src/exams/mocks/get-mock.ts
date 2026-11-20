import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { z } from "zod";
import { canMoveToMonday, loadChallengeMoveRules } from "../../checkpoints/_utils/challenge-move";
import { EXAM_DAY_CHECKLIST } from "../../checkpoints/weekly-challenge-rules";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type PassMarks, getPassMarks } from "../../library/exams/pass-marks";
import { getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { NO_RESULT_MOMENTS, loadResultMoments } from "../../milestones/load-ceremony";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS } from "../../sessions/brain-power";
import { NOTHING_REACHED, reachedSchema } from "../../sessions/reached";
import { getNamedEssayRubric } from "../essays/essay-rubric";
import { getExamDocument } from "../exam-document";
import { getScoreNotes } from "../scoring/mock-scoring";
import { loadMockPlanOffers } from "./_utils/mock-adapt";
import { loadSkillAreas } from "./_utils/mock-candidates";
import { buildMockConditions } from "./_utils/mock-conditions";
import { loadCurrentSection } from "./_utils/mock-current-section";
import { loadMockEssayViews } from "./_utils/mock-essays";
import { loadMockMissionMoment } from "./_utils/mock-mission-moment";
import { countFinishedMocksBefore } from "./_utils/mock-number";
import { loadMockReview } from "./_utils/mock-review";
import { getAskedItemIds, getEssayItemIds, toSectionViews } from "./_utils/mock-sections";
import { loadMockSpeaking } from "./_utils/mock-speaking";
import { loadAskedTypedParts } from "./_utils/mock-typed-parts";
import { type MockSitting, type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { readMockSizeSource } from "./_utils/read-mock-structure";
import { type MockConditions, type MockView, mockResultSchema } from "./mock-contract";
import { type MockTypedPart, listSatMockLeftOut } from "./mock-left-out";
import { getMockDays } from "./mock-plan";
import { getMockVerdict } from "./mock-verdict";
import { withMockWrittenPoints } from "./mock-written-points";

const keptReachedSchema = z.object({ reached: reachedSchema });

export type MockViewResult =
  | { mock: MockView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function getMockNumber(owned: OwnedMock): Promise<number> {
  const earlier = await countFinishedMocksBefore({
    createdAt: owned.mock?.createdAt,
    goalId: owned.goal?.id ?? null,
  });

  return earlier + 1;
}

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
  return canMoveToMonday({ item, rules, today });
}

function getStatus(mock: MockSitting | null): MockView["status"] {
  if (!mock) {
    return "ready";
  }

  return mock.status === "active" ? "running" : mock.status;
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
    return {
      adapt: null,
      essays: [],
      mistakes: [],
      reached: NOTHING_REACHED,
      result: null,
      review: [],
    };
  }

  const result = mockResultSchema.safeParse(owned.mock.result).data ?? null;
  const reached = keptReachedSchema.safeParse(owned.mock.result).data?.reached ?? NOTHING_REACHED;

  const [review, offers, { numericBlankItems, views: essays }] = await Promise.all([
    loadMockReview({ areas, conditions, mockExamId: owned.mock.id, userId: owned.userId }),
    loadMockPlanOffers({ goal: owned.goal, purpose: conditions.purpose, result }),
    loadMockEssayViews({ areas, mock: owned.mock }),
  ]);

  return {
    ...review,
    adapt: offers?.view ?? null,
    essays,
    reached,
    result: withMockWrittenPoints({ conditions, essays, numericBlankItems, result }),
  };
}

function getMockPassMarks({
  conditions,
  owned,
}: {
  conditions: MockConditions;
  owned: OwnedMock;
}): PassMarks | null {
  const isWholeExam = conditions.fullLength && getMockDays(owned.structure).length === 1;

  return isWholeExam && owned.structure && owned.blueprint
    ? getPassMarks({ blueprint: owned.blueprint, goal: owned.goal, structure: owned.structure })
    : null;
}

function describeOwner({
  conditions,
  owned,
  result,
  typed,
}: {
  conditions: MockConditions;
  owned: OwnedMock;
  result: MockView["result"];
  typed: readonly MockTypedPart[];
}) {
  const asksEssays = getEssayItemIds(conditions).length > 0;

  const kinds = listWrittenTasks({
    day: conditions.day ?? undefined,
    structure: owned.structure,
  }).map(({ grading }) => grading.kind);

  const rubric = kinds.find((kind) => kind !== "levels") ?? getNamedEssayRubric(owned.blueprint);

  return {
    date: toIsoDate(owned.sessionDate),
    essayRubric: asksEssays ? (rubric ?? ("levels" as const)) : null,
    examDocument: owned.goal ? getExamDocument(owned.goal) : "notice",
    examName: owned.blueprint?.name ?? owned.goal?.title ?? null,
    goalId: owned.goal?.id ?? null,
    leftOut: listSatMockLeftOut({ conditions, structure: owned.structure, typed }),
    passMarks: getMockPassMarks({ conditions, owned }),
    scoreNotes: getScoreNotes({
      blueprint: owned.blueprint,
      goal: owned.goal,
      scoring: conditions.scoring,
      share: result && result.total > 0 ? result.correct / result.total : null,
      structure: owned.structure,
    }),
    scoringNote: owned.structure?.mock?.scoring.description ?? null,
    sessionId: owned.block?.sessionId ?? null,
    sizeSource: readMockSizeSource(owned.blueprint),
    trueFalseLabels: getTrueFalseLabels(owned.structure),
  };
}

/** Accepts a scheduled mock's block id or an anytime mock's own id; running questions contain no answers. */
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

  const breakUntil =
    running && running.sectionStartedAt.getTime() > Date.now() ? running.sectionStartedAt : null;

  const [number, current, finished, canMove, typed, speaking, missionMoment, moments] =
    await Promise.all([
      getMockNumber(owned),
      running && !breakUntil ? loadCurrentSection({ areas, mock: running }) : null,
      loadFinished({ areas, conditions, owned }),
      canMoveMock(owned),
      loadAskedTypedParts(getAskedItemIds(conditions).map((entry) => entry.itemId)),
      loadMockSpeaking(mock),
      loadMockMissionMoment({ mock, timeZone: getAnswerTimeZone({ goal: owned.goal }) }),
      mock?.status === "finished" ? loadResultMoments(owned.userId) : NO_RESULT_MOMENTS,
    ]);

  return {
    mock: {
      ...describeOwner({ conditions, owned, result: finished.result, typed }),
      adapt: finished.adapt,
      blockId,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      breakUntil: breakUntil?.toISOString() ?? null,
      canMove,
      ...moments,
      checklist: [...EXAM_DAY_CHECKLIST],
      current,
      day: conditions.day,
      essays: finished.essays,
      examQuestions: conditions.examQuestions,
      fullLength: conditions.fullLength,
      minutes: conditions.sections.reduce((sum, section) => sum + section.minutes, 0),
      missionMoment,
      mistakes: finished.mistakes,
      number,
      pacing: conditions.pacing,
      planItemId: owned.payload.planItemId,
      purpose: conditions.purpose,
      questions: conditions.sections.reduce((sum, section) => sum + section.questions, 0),
      reached: finished.reached,
      result: finished.result,
      reusedQuestions: conditions.reused,
      review: finished.review,
      scoring: conditions.scoring,
      sections: toSectionViews({
        conditions,
        current: running ? running.sectionIndex : null,
        finished: mock?.status === "finished",
      }),
      shape: conditions.shape,
      speaking,
      startTime: conditions.startTime,
      status: getStatus(mock),
      timeZone: conditions.timeZone,
      verdict:
        finished.result &&
        getMockVerdict({ result: finished.result, subjects: owned.structure?.subjects ?? [] }),
    },
    status: "ready",
  };
}
