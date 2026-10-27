import { Prisma, type StudyBlockKind } from "../../../../generated/prisma/client";
import { localTimeFields } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { type LearnerScope, scopeDay } from "./write-goal";
import { type HistoryEvent, type StudyDay, getBrainPower, listStudyDays } from "./write-history";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/**
 * A boss or mock the persona played on a past day. The seed writes its block with the result its
 * history gives (`correct` of `total`); core picks the questions it asked, the way the session
 * builder picks them, and records the answers and a mock's sitting (see `SeededPast`).
 */
export type PastCheckpoint = {
  blockId: string;
  completedAt: Date;
  correct: number;
  kind: "boss" | "mock";
  /** The learner-local date it was played on, as `@db.Date` columns store it. */
  localDate: Date;
  /** The id a mock's sitting gets, the same on every run. */
  mockExamId: string;
  planItemId: string | null;
  sessionId: string;
  startedAt: Date;
  total: number;
};

/**
 * The persona's past sessions, written before its plan is made: the bosses and mocks among their
 * blocks still need their questions, which core picks once the plan is made, and `settle` puts the
 * result of the questions a block got in the ledger when they aren't the `total` its history
 * gives (see `settleCheckpoint`).
 */
export type SeededPast = {
  checkpoints: PastCheckpoint[];
  settle: (checkpoint: PastCheckpoint, result: PastResult) => Promise<PastCheckpoint>;
};

/** A block's minutes, as a session estimates them: whole minutes, never none. */
function toBlockMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
}

function pastSessionId(scope: LearnerScope, day: number): string {
  return seedId(`learner:${scope.learner.key}:session:past:${day}`);
}

function pastBlockId(scope: LearnerScope, { day, position }: { day: number; position: number }) {
  return seedId(`learner:${scope.learner.key}:session:past:${day}:block:${position}`);
}

/** The phase of the plan item a boss or mock on `day` belongs to. */
function findItemPhase(scope: LearnerScope, event: HistoryEvent): number | null {
  const kinds = event.kind === "mock" ? ["mock"] : ["boss", "checkpoint"];

  return (
    scope.learner.goal.plan.items.find(
      (item) => kinds.includes(item.kind) && item.day === event.day,
    )?.phase ?? null
  );
}

/**
 * A ledger row's block as the session that played it holds it: the lesson a learn block taught, a
 * challenge's kind and plan item. Core fills in the questions a boss or mock asked; the seed keeps
 * no record of which questions past practice and reviews asked, as with the ledger.
 */
function toBlock(
  scope: LearnerScope,
  event: HistoryEvent,
): { kind: StudyBlockKind; lessonId: string | null; payload: Prisma.InputJsonObject } {
  const { chapterId = null, lessonId = null, planItemId = null } = event.contentIds;
  const title = event.title || null;

  if (event.kind === "lesson") {
    return { kind: "learn", lessonId, payload: { chapterId, title } };
  }

  if (event.kind === "review") {
    return { kind: "review", lessonId: null, payload: { title } };
  }

  if (event.kind !== "mock" && event.kind !== "checkpoint") {
    return { kind: "practice", lessonId: null, payload: { title } };
  }

  const mock = event.kind === "mock";

  return {
    kind: "checkpoint",
    lessonId: null,
    payload: {
      checkpoint: {
        kind: mock ? "weekly" : "boss",
        mock,
        passMark: 0,
        phase: findItemPhase(scope, event),
        rematch: false,
        timeLimitMinutes: null,
      },
      planItemId,
      title,
    },
  };
}

function toPastCheckpoint(
  scope: LearnerScope,
  {
    block,
    day,
    event,
  }: { block: { id: string; sessionId: string }; day: number; event: TimedEvent },
): PastCheckpoint[] {
  if (event.kind !== "mock" && event.kind !== "checkpoint") {
    return [];
  }

  return [
    {
      blockId: block.id,
      completedAt: event.endedAt,
      correct: event.correct,
      kind: event.kind === "mock" ? "mock" : "boss",
      localDate: scopeDay(scope, day),
      mockExamId: seedId(`learner:${scope.learner.key}:mock:${day}`),
      planItemId: event.contentIds.planItemId ?? null,
      sessionId: block.sessionId,
      startedAt: event.startedAt,
      total: event.correct + event.incorrect,
    },
  ];
}

type TimedEvent = HistoryEvent & { endedAt: Date; startedAt: Date };

function timeEvents(events: readonly HistoryEvent[]): TimedEvent[] {
  return events.flatMap((event) =>
    event.endedAt
      ? [
          {
            ...event,
            endedAt: event.endedAt,
            startedAt: new Date(event.endedAt.getTime() - event.seconds * MS_PER_SECOND),
          },
        ]
      : [],
  );
}

async function writeStudyDay(
  scope: LearnerScope,
  { day, events, goalId }: StudyDay & { goalId: string },
): Promise<PastCheckpoint[]> {
  const { prisma, userId } = scope;
  const timed = timeEvents(events);
  const first = timed[0];
  const last = timed.at(-1);

  if (!first || !last) {
    return [];
  }

  const sessionId = pastSessionId(scope, day);

  const blocks = timed.map((event, position) => ({
    ...toBlock(scope, event),
    brainPower: getBrainPower(event.kind),
    completedAt: event.endedAt,
    createdAt: event.startedAt,
    estimatedMinutes: toBlockMinutes(event.seconds),
    id: pastBlockId(scope, { day, position }),
    position,
    sessionId,
    startedAt: event.startedAt,
    status: "completed" as const,
  }));

  await prisma.studySession.create({
    data: {
      createdAt: first.startedAt,
      endedAt: last.endedAt,
      goalId,
      id: sessionId,
      localDate: scopeDay(scope, day),
      missions: { picks: [], version: 1 },
      plannedMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
      startSnapshot: Prisma.DbNull,
      startedAt: first.startedAt,
      status: "completed",
      userId,
    },
  });

  await prisma.studySessionBlock.createMany({ data: blocks });

  return blocks.flatMap((block, position) => {
    const event = timed[position];
    return event ? toPastCheckpoint(scope, { block, day, event }) : [];
  });
}

/**
 * What a boss or mock got: `correct` of `total` questions right, in `seconds`, in a block planned
 * for `minutes` (its time when absent).
 */
export type PastResult = { correct: number; minutes?: number; seconds: number; total: number };

/**
 * A boss or mock's result as its questions give it, when the Library had other than the `total`
 * the persona's history gives it: its ledger row, its block and session, and its day's totals.
 * Returns the checkpoint as it ended.
 */
async function settleCheckpoint(
  scope: LearnerScope,
  checkpoint: PastCheckpoint,
  { correct, minutes, seconds, total }: PastResult,
): Promise<PastCheckpoint> {
  const { learner, prisma, userId } = scope;
  const completedAt = new Date(checkpoint.startedAt.getTime() + seconds * MS_PER_SECOND);
  const settled = { ...checkpoint, completedAt, correct, total };

  if (
    correct === checkpoint.correct &&
    total === checkpoint.total &&
    completedAt.getTime() === checkpoint.completedAt.getTime()
  ) {
    return settled;
  }

  await Promise.all([
    prisma.learningEvent.updateMany({
      data: {
        correctAnswers: correct,
        endedAt: completedAt,
        incorrectAnswers: total - correct,
        seconds,
        ...localTimeFields(completedAt, learner.timeZone),
      },
      where: {
        endedAt: checkpoint.completedAt,
        kind: checkpoint.kind === "mock" ? "mock" : "checkpoint",
        userId,
      },
    }),
    prisma.studySessionBlock.update({
      data: { completedAt, estimatedMinutes: minutes ?? toBlockMinutes(seconds) },
      where: { id: checkpoint.blockId },
    }),
  ]);

  const [blocks, rows] = await Promise.all([
    prisma.studySessionBlock.findMany({ where: { sessionId: checkpoint.sessionId } }),
    prisma.learningEvent.findMany({ where: { localDate: checkpoint.localDate, userId } }),
  ]);

  const addUp = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((sum, row) => sum + pick(row), 0);

  const right = addUp((row) => row.correctAnswers);
  const wrong = addUp((row) => row.incorrectAnswers);
  const ends = blocks.flatMap((block) => (block.completedAt ? [block.completedAt.getTime()] : []));

  await Promise.all([
    prisma.studySession.update({
      data: {
        endedAt: new Date(Math.max(...ends)),
        plannedMinutes: blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
      },
      where: { id: checkpoint.sessionId },
    }),
    prisma.dailyProgress.update({
      data: {
        correctAnswers: right,
        incorrectAnswers: wrong,
        interactiveCompleted: right + wrong,
        timeSpentSeconds: addUp((row) => row.seconds),
      },
      where: { userDate: { date: checkpoint.localDate, userId } },
    }),
  ]);

  return settled;
}

/**
 * Writes a session for each past day the learner studied (see `listStudyDays`), finished, with a
 * block for each ledger row of the day, timed as the ledger times them: the week's days, a boss's
 * result and a mock's sitting read them. Run `clearSessions` first.
 */
export async function writePastSessions(scope: LearnerScope, goalId: string): Promise<SeededPast> {
  const days = await Promise.all(
    listStudyDays(scope).map((day) => writeStudyDay(scope, { ...day, goalId })),
  );

  return {
    checkpoints: days.flat(),
    settle: (checkpoint, result) => settleCheckpoint(scope, checkpoint, result),
  };
}
