import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getMovableDay, loadChallengeMoveRules } from "../../checkpoints/_utils/challenge-move";
import { EXAM_DAY_CHECKLIST } from "../../checkpoints/weekly-challenge-rules";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type PassMarks, getPassMarks } from "../../library/exams/pass-marks";
import { getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS } from "../../sessions/brain-power";
import { getEssayRubric } from "../essays/essay-rubric";
import { getExamDocument } from "../exam-document";
import { getScoreNotes } from "../scoring/mock-scoring";
import { loadMockPlanOffers } from "./_utils/mock-adapt";
import { readMockAnswer } from "./_utils/mock-answers";
import { loadSkillAreas } from "./_utils/mock-candidates";
import { buildMockConditions } from "./_utils/mock-conditions";
import { loadMockEssayItems, loadMockEssayViews } from "./_utils/mock-essays";
import { loadMockItems, toMockQuestionView } from "./_utils/mock-items";
import { loadMockMissionMoment } from "./_utils/mock-mission-moment";
import { getSectionPlace } from "./_utils/mock-navigation";
import { countFinishedMocksBefore } from "./_utils/mock-number";
import { listSectionPlays } from "./_utils/mock-plays";
import { loadMockReview } from "./_utils/mock-review";
import {
  getAskedItemIds,
  getEssayItemIds,
  getFirstNumber,
  toSectionViews,
} from "./_utils/mock-sections";
import { loadMockSpeaking } from "./_utils/mock-speaking";
import { loadAskedTypedParts } from "./_utils/mock-typed-parts";
import {
  type MockSitting,
  type OwnedMock,
  findOwnedMock,
  getSectionDeadline,
} from "./_utils/owned-mock";
import { readMockSizeSource } from "./_utils/read-mock-structure";
import { type MockConditions, type MockView, mockResultSchema } from "./mock-contract";
import { type MockTypedPart, listSatMockLeftOut } from "./mock-left-out";
import { getMockDays } from "./mock-plan";
import { type MockQuestion } from "./mock-view-contract";

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

  const [items, essays] = await Promise.all([
    loadMockItems(section.itemIds),
    loadMockEssayItems(section.essays),
  ]);

  const first = getFirstNumber({ conditions: mock.conditions, section: mock.sectionIndex });

  const questions = section.itemIds.flatMap((itemId, index): MockQuestion[] => {
    const item = items.get(itemId);

    return item
      ? [
          {
            ...toMockQuestionView({ item, mockId: mock.id }),
            area: areas.get(item.skillId) ?? null,
            number: first + index,
          },
        ]
      : [];
  });

  // The written part comes after the section's questions, as on the exam's answer sheet.
  const written = section.essays.flatMap((itemId, index): MockQuestion[] => {
    const essay = essays.get(itemId);

    return essay
      ? [
          {
            area: areas.get(essay.item.skillId) ?? null,
            context: essay.content.context,
            entry: null,
            format: "essay",
            image: null,
            itemId,
            number: first + section.questions + index,
            options: null,
            question: essay.content.question,
            select: null,
            set: null,
            skillId: essay.item.skillId,
            unit: null,
            visual: null,
          },
        ]
      : [];
  });

  const asked = new Set([...section.itemIds, ...section.essays]);
  const shownIds = [...questions, ...written].map((question) => question.itemId);
  const rows = mock.answers.filter((answer) => asked.has(answer.itemId));

  const drafts = rows.map((answer) => ({
    answer: readMockAnswer(answer.answer),
    durationMs: answer.durationMs,
    flagged: answer.flagged,
    itemId: answer.itemId,
  }));

  return {
    ...getSectionPlace({ itemIds: shownIds, navigation: section.navigation, rows }),
    deadline: getSectionDeadline(mock).toISOString(),
    drafts,
    kind: section.kind ?? null,
    plays: listSectionPlays({ plays: mock.listeningPlays, questions }),
    questions: [...questions, ...written],
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
  return rules.mondayOpen && getMovableDay({ item, rules, today }) !== null;
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
    return { adapt: null, essays: [], mistakes: [], result: null, review: [] };
  }

  const result = mockResultSchema.safeParse(owned.mock.result).data ?? null;

  const [review, offers, essays] = await Promise.all([
    loadMockReview({ areas, conditions, mockExamId: owned.mock.id, userId: owned.userId }),
    loadMockPlanOffers({ goal: owned.goal, purpose: conditions.purpose, result }),
    loadMockEssayViews({ areas, mock: owned.mock }),
  ]);

  return { ...review, adapt: offers?.view ?? null, essays, result };
}

/**
 * The notice's pass marks, for a mock of the whole exam: a full mock of an exam held on one day.
 * A part of the exam (half of it, a subject, one of ENEM's two days) says nothing about passing.
 */
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

/**
 * Where the mock belongs (its goal and exam, the session it was played in, if any) and what the
 * exam's notice says about it: how it's scored and passed, and where its size comes from.
 */
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

  return {
    date: toIsoDate(owned.sessionDate),
    essayRubric: asksEssays
      ? getEssayRubric({ blueprint: owned.blueprint, criteria: [] }).kind
      : null,
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

/**
 * One of the learner's mock exams, by the id it opens by (its session block's, or its own for a
 * mock taken any time): the exam's conditions before it starts, the running section with its
 * deadline and drafts (never the answers), and after it, what it showed with the questions to
 * review. One whose time ran out while the learner was away is `expired`, with nothing to show.
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
  // Between two sections, the next one's clock starts once the break ends.
  const breakUntil =
    running && running.sectionStartedAt.getTime() > Date.now() ? running.sectionStartedAt : null;

  const [number, current, finished, canMove, typed, speaking, missionMoment] = await Promise.all([
    getMockNumber(owned),
    running && !breakUntil ? loadCurrentSection({ areas, mock: running }) : null,
    loadFinished({ areas, conditions, owned }),
    canMoveMock(owned),
    loadAskedTypedParts(getAskedItemIds(conditions).map((entry) => entry.itemId)),
    loadMockSpeaking(conditions),
    loadMockMissionMoment({ mock, timeZone: getAnswerTimeZone({ goal: owned.goal }) }),
  ]);

  return {
    mock: {
      ...describeOwner({ conditions, owned, result: finished.result, typed }),
      adapt: finished.adapt,
      blockId,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      breakUntil: breakUntil?.toISOString() ?? null,
      canMove,
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
      planItemId: owned.payload.planItemId,
      purpose: conditions.purpose,
      questions: conditions.sections.reduce((sum, section) => sum + section.questions, 0),
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
    },
    status: "ready",
  };
}
