import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type PastCheckpoint, type SeededPast } from "@zoonk/db/seed/v2";
import { getDateInTimeZone, getHourInTimeZone } from "@zoonk/utils/time-zone";
import { loadCheckpointCandidates } from "../checkpoints/_utils/checkpoint-candidates";
import { getPassMark, selectCheckpointItems } from "../checkpoints/checkpoint-rules";
import { readExamChoices } from "../exams/choices/exam-choices";
import { loadSkillAreas } from "../exams/mocks/_utils/mock-candidates";
import { buildMockConditions } from "../exams/mocks/_utils/mock-conditions";
import { gradeMockItem } from "../exams/mocks/_utils/mock-item-grading";
import { type MockItem, loadMockItems } from "../exams/mocks/_utils/mock-items";
import { getAskedItemIds } from "../exams/mocks/_utils/mock-sections";
import { planWeeklyMock } from "../exams/mocks/_utils/plan-weekly-mock";
import { readMockStructure } from "../exams/mocks/_utils/read-mock-structure";
import { type GradedMockAnswer, analyzeMock } from "../exams/mocks/mock-analysis";
import { type MockAnswer } from "../exams/mocks/mock-answer-contract";
import { type MockConditions } from "../exams/mocks/mock-contract";
import { getPlannedItemIds } from "../exams/mocks/mock-plan";
import { getPickOutcome } from "../exams/scoring/partial-credit";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { gradeSessionAnswer, parseSessionItem } from "../sessions/_utils/session-items";
import { readBlockPayload, toBlockPayload } from "../sessions/block-payload";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const SECONDS_PER_MINUTE = 60;

/** A mock's time the persona used: most of it, as a learner who checks their answers does. */
const MOCK_TIME_USED = 0.85;

/**
 * Whether the question at `index` was answered right, with the wrong ones spread over the
 * questions: `correct` right out of `total`.
 */
function isRightAt({ correct, index, total }: { correct: number; index: number; total: number }) {
  const wrong = total - correct;
  return Math.floor(((index + 1) * wrong) / total) === Math.floor((index * wrong) / total);
}

/** How many of `asked` questions were right, at the share the persona's history gives. */
function scaleCorrect({ asked, checkpoint }: { asked: number; checkpoint: PastCheckpoint }) {
  return checkpoint.total > 0 ? Math.round((checkpoint.correct / checkpoint.total) * asked) : 0;
}

/** Learner-local date, hour and weekday of an answer, as attempts store them. */
function localFields(date: Date, timeZone: string) {
  const localDate = getDateInTimeZone({ date, timeZone });
  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

/** When each of `count` answers was given, one after another over the block's time. */
function answerMoments(checkpoint: PastCheckpoint, count: number): Date[] {
  const step = (checkpoint.completedAt.getTime() - checkpoint.startedAt.getTime()) / (count + 1);

  return Array.from(
    { length: count },
    (_, index) => new Date(checkpoint.startedAt.getTime() + step * (index + 1)),
  );
}

/** A duel question answered as a session records it: the right answer, or "I don't know". */
function toDuelAnswer({
  blockId,
  isRight,
  item,
}: {
  blockId: string;
  isRight: boolean;
  item: Parameters<typeof parseSessionItem>[0];
}) {
  const question = parseSessionItem(item);

  if (!question) {
    return null;
  }

  const unknown = gradeSessionAnswer({ answer: { dontKnow: true }, blockId, item: question });

  return isRight
    ? gradeSessionAnswer({ answer: unknown.correctAnswer, blockId, item: question })
    : unknown;
}

/** A block's time spent, in seconds. */
function getSeconds(checkpoint: Pick<PastCheckpoint, "completedAt" | "startedAt">): number {
  return Math.round(
    (checkpoint.completedAt.getTime() - checkpoint.startedAt.getTime()) / MS_PER_SECOND,
  );
}

/**
 * A boss the persona fought: the questions the session builder picks for its phase (see
 * `selectCheckpointItems`), answered in its block with the result the history gives.
 */
async function fillBoss({
  checkpoint,
  goal,
  past,
}: {
  checkpoint: PastCheckpoint;
  goal: Goal;
  past: SeededPast;
}): Promise<void> {
  const item = checkpoint.planItemId
    ? await prisma.planItem.findUnique({ where: { id: checkpoint.planItemId } })
    : null;

  if (!item) {
    return;
  }

  const plan = await loadGoalPlan(goal.id);

  const skillIds = plan.skills
    .filter((skill) => skill.phase === item.phase)
    .map((skill) => skill.id);

  const candidates = await loadCheckpointCandidates({
    examBlueprintId: goal.examBlueprintId,
    skillIds,
    userId: goal.userId,
  });

  const itemIds = selectCheckpointItems({ candidates, skillIds }).slice(0, checkpoint.total);
  const rows = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const asked = itemIds.flatMap((id) => byId.get(id) ?? []);
  const correct = scaleCorrect({ asked: asked.length, checkpoint });

  const graded = asked.flatMap((row, index) => {
    const isRight = isRightAt({ correct, index, total: asked.length });
    const answer = toDuelAnswer({ blockId: checkpoint.blockId, isRight, item: row });
    return answer ? [{ answer, row }] : [];
  });

  const ended = await past.settle(checkpoint, {
    correct: graded.filter(({ answer }) => answer.isCorrect).length,
    seconds: Math.round((getSeconds(checkpoint) * graded.length) / Math.max(checkpoint.total, 1)),
    total: graded.length,
  });

  const moments = answerMoments(ended, graded.length);
  const durationMs = Math.round((getSeconds(ended) * MS_PER_SECOND) / Math.max(graded.length, 1));

  const block = await prisma.studySessionBlock.findUniqueOrThrow({
    where: { id: checkpoint.blockId },
  });

  const payload = readBlockPayload(block);

  await Promise.all([
    prisma.attempt.createMany({
      data: graded.map(({ answer, row }, index) => {
        const answeredAt = moments[index] ?? ended.completedAt;

        return {
          answer: answer.recorded,
          answeredAt,
          durationMs,
          isCorrect: answer.isCorrect,
          itemId: row.id,
          skillId: row.skillId,
          studySessionId: checkpoint.sessionId,
          userId: goal.userId,
          ...localFields(answeredAt, goal.timezone ?? "UTC"),
        };
      }),
    }),
    prisma.studySessionBlock.update({
      data: {
        payload: toBlockPayload({
          ...payload,
          checkpoint: payload.checkpoint && {
            ...payload.checkpoint,
            passMark: getPassMark(graded.length),
          },
          itemIds: graded.map(({ row }) => row.id),
          skillIds,
        }),
      },
      where: { id: checkpoint.blockId },
    }),
  ]);
}

/** The picks a question takes: its options, true or false; none for an answer typed in. */
function listPicks(item: MockItem): MockAnswer[] {
  if (item.format === "multipleChoice") {
    return item.content.options.map((_, selectedIndex) => ({ selectedIndex }));
  }

  return item.format === "trueFalse" ? [{ isTrue: true }, { isTrue: false }] : [];
}

/** A pick a mock grades right or wrong: the first option that grades that way; blank otherwise. */
function pickAnswer({
  conditions,
  isRight,
  item,
  mockId,
}: {
  conditions: MockConditions;
  isRight: boolean;
  item: MockItem;
  mockId: string;
}): MockAnswer | null {
  return (
    listPicks(item).find(
      (answer) =>
        gradeMockItem({ answer, item, mockId, partialCredit: conditions.partialCredit })
          .isCorrect === isRight,
    ) ?? null
  );
}

/**
 * The mock's questions answered: `correct` of them right, spread over it, the rest wrong, each
 * graded the way the hand-in grades it (see `gradeMock`).
 */
async function answerMock({
  areas,
  checkpoint,
  conditions,
  correct,
  durationMs,
  questions,
  skillIds,
}: {
  areas: ReadonlyMap<string, string>;
  checkpoint: PastCheckpoint;
  conditions: MockConditions;
  correct: number;
  durationMs: number;
  questions: readonly { item: MockItem; section: number }[];
  skillIds: readonly string[];
}) {
  const skills = await prisma.skill.findMany({ where: { id: { in: [...skillIds] } } });
  const skillNames = new Map(skills.map((skill) => [skill.id, skill.name]));

  return questions.map(({ item, section }, index) => {
    const isRight = isRightAt({ correct, index, total: questions.length });
    const answer = pickAnswer({ conditions, isRight, item, mockId: checkpoint.mockExamId });

    const grade = gradeMockItem({
      answer,
      item,
      mockId: checkpoint.mockExamId,
      partialCredit: conditions.partialCredit,
    });

    const result: GradedMockAnswer = {
      area: areas.get(item.skillId) ?? null,
      credit: grade.credit,
      durationMs,
      flagged: false,
      irtItem: item.irt,
      outcome: getPickOutcome({ answered: grade.answered, credit: grade.credit }),
      section,
      skill: { id: item.skillId, name: skillNames.get(item.skillId) ?? "" },
      timedOut: false,
    };

    return { answer, grade, item, result };
  });
}

/**
 * A mock the persona took: planned from the bank as the session builder plans the week's mock
 * (see `planWeeklyMock`), its sitting finished with every question answered at the share its
 * history gives, the answers recorded as the hand-in records them, and the result graded the way
 * the hand-in grades it, which the exam page and its chart read. The block asks those questions.
 */
async function fillMock({
  checkpoint,
  goal,
  past,
}: {
  checkpoint: PastCheckpoint;
  goal: Goal;
  past: SeededPast;
}): Promise<void> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  const [plan, settings, block] = await Promise.all([
    loadGoalPlan(goal.id),
    prisma.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: checkpoint.blockId } }),
  ]);

  if (!blueprint) {
    return;
  }

  const structure = readMockStructure({ blueprint, choices: readExamChoices(settings?.settings) });
  const skillIds = plan.skills.map((skill) => skill.id);

  const planned = await planWeeklyMock({
    goal,
    skillIds,
    structure,
    today: checkpoint.localDate,
    userId: goal.userId,
  });

  const payload = toBlockPayload({
    ...readBlockPayload(block),
    itemIds: getPlannedItemIds(planned),
    skillIds,
  });

  const conditions = await buildMockConditions({
    blueprint,
    goal,
    payload,
    sessionDate: checkpoint.localDate,
    structure,
    userId: goal.userId,
  });

  const asked = getAskedItemIds(conditions);

  const [items, areas] = await Promise.all([
    loadMockItems(asked.map((entry) => entry.itemId)),
    loadSkillAreas(goal.id),
  ]);

  const questions = asked.flatMap((entry) => {
    const item = items.get(entry.itemId);
    return item ? [{ ...entry, item }] : [];
  });

  const correct = scaleCorrect({ asked: questions.length, checkpoint });
  const minutes = Math.round(planned.minutes * MOCK_TIME_USED);
  const durationMs = Math.round((minutes * MS_PER_MINUTE) / Math.max(questions.length, 1));

  const graded = await answerMock({
    areas,
    checkpoint,
    conditions,
    correct,
    durationMs,
    questions,
    skillIds,
  });

  const result = analyzeMock({
    answers: graded.map((entry) => entry.result),
    conditions,
    minutesUsed: minutes,
    preparation: null,
    previous: null,
  });

  const ended = await past.settle(checkpoint, {
    correct: result.correct,
    minutes: planned.minutes,
    seconds: minutes * SECONDS_PER_MINUTE,
    total: questions.length,
  });

  const moments = answerMoments(ended, questions.length);

  await prisma.mockExam.create({
    data: {
      blockId: checkpoint.blockId,
      conditions,
      examBlueprintId: blueprint.id,
      finishedAt: ended.completedAt,
      goalId: goal.id,
      id: checkpoint.mockExamId,
      result,
      sectionIndex: conditions.sections.length,
      sectionStartedAt: checkpoint.startedAt,
      startedAt: checkpoint.startedAt,
      status: "finished",
      userId: goal.userId,
    },
  });

  await Promise.all([
    prisma.mockExamAnswer.createMany({
      data: graded.map(({ answer, item }) => ({
        answer: answer ?? undefined,
        durationMs,
        itemId: item.id,
        mockExamId: checkpoint.mockExamId,
      })),
    }),
    prisma.attempt.createMany({
      data: graded.map(({ grade, item }, index) => {
        const answeredAt = moments[index] ?? ended.completedAt;

        return {
          answer: grade.recorded,
          answeredAt,
          durationMs,
          isCorrect: grade.isCorrect,
          itemId: item.id,
          mockExamId: checkpoint.mockExamId,
          skillId: item.skillId,
          studySessionId: checkpoint.sessionId,
          userId: goal.userId,
          ...localFields(answeredAt, goal.timezone ?? "UTC"),
        };
      }),
    }),
    prisma.studySessionBlock.update({
      data: {
        payload: toBlockPayload({
          ...payload,
          checkpoint: payload.checkpoint && {
            ...payload.checkpoint,
            passMark: getPassMark(questions.length),
            timeLimitMinutes: planned.minutes,
          },
          itemIds: asked.map((entry) => entry.itemId),
        }),
      },
      where: { id: checkpoint.blockId },
    }),
  ]);
}

/**
 * Fills the bosses and mocks of a seeded persona's past sessions once its plan is made (see
 * `SeededPast`): the questions each asked and the answers it got, and a mock's finished sitting.
 * No model is called.
 */
export async function buildSeededPast({ goalId, past }: { goalId: string; past: SeededPast }) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  // One after another: a later boss ranks the questions an earlier one asked as seen.
  await past.checkpoints.reduce(
    (previous, checkpoint) =>
      previous.then(() =>
        checkpoint.kind === "mock"
          ? fillMock({ checkpoint, goal, past })
          : fillBoss({ checkpoint, goal, past }),
      ),
    Promise.resolve(),
  );
}
