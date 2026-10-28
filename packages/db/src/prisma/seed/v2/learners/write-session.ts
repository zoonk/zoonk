import {
  type MasteryState,
  Prisma,
  type StudyBlockKind,
  type StudyBlockStatus,
  type StudyFreshStart,
  type StudySessionStatus,
} from "../../../../generated/prisma/client";
import { localTimeFields } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { toLearnerSkillMemory } from "./memory-presets";
import { type SeedLearner } from "./types";
import { type LearnerScope, scopeDay } from "./write-goal";
import { writeTodayHistory } from "./write-history";
import { studyMoment, writeAttempts } from "./write-learning";

type SeedSession = NonNullable<SeedLearner["session"]>;

const ENERGY_GAINED_TODAY = 3;

export type BuiltBlock = {
  canDo: string | null;
  estimatedMinutes: number;
  kind: StudyBlockKind;
  lessonId: string | null;
  payload: Prisma.InputJsonObject & {
    capsules: readonly { itemIds: readonly string[]; lessonId: string | null; title: string }[];
    chapterId: string | null;
    drills: readonly { itemIds: readonly string[] }[];
    itemIds: readonly string[];
    title: string | null;
  };
};

export type BlockAnswer = { answer: Prisma.InputJsonObject; itemId: string; skillId: string };

export type BuiltDay = {
  /** By the block's position. */
  answers: ReadonlyMap<number, readonly BlockAnswer[]>;
  blocks: readonly BuiltBlock[];
  freshStart: StudyFreshStart | null;
  missions: Prisma.InputJsonObject;
  planVersion: number | null;
};

export type FinishedBlock = BuiltBlock & {
  answers: readonly BlockAnswer[];
  completedAt: Date;
  startedAt: Date;
};

export type SeededToday = {
  localDate: Date;
  now: Date;
  timeZone: string;
  /** The id the block at `position` gets: a math problem's numbers depend on its block. */
  blockId: (position: number) => string;
  write: (day: BuiltDay) => Promise<FinishedBlock[]>;
};

function todaySessionId(learner: SeedLearner): string {
  return seedId(`learner:${learner.key}:session:today`);
}

function todayBlockId(learner: SeedLearner, position: number): string {
  return seedId(`learner:${learner.key}:session:today:block:${position}`);
}

function getBlockStatus(session: SeedSession, position: number): StudyBlockStatus {
  if (position < session.finished) {
    return "completed";
  }

  return position === session.finished && session.started ? "active" : "pending";
}

function getSessionStatus(session: SeedSession, blocks: readonly BuiltBlock[]): StudySessionStatus {
  if (blocks.length > 0 && session.finished >= blocks.length) {
    return "completed";
  }

  return session.finished > 0 || session.started ? "active" : "planned";
}

function toStartSnapshot(scope: LearnerScope, earnedToday: number): Prisma.InputJsonObject {
  const { learner, lookup, now } = scope;

  const skillStates: Record<string, MasteryState> = Object.fromEntries(
    learner.skills.map(({ memory, skill }) => [
      lookup.skill(skill),
      toLearnerSkillMemory(memory, now).state,
    ]),
  );

  return {
    brainPower: learner.brainPower - earnedToday,
    energy: learner.history.energy - ENERGY_GAINED_TODAY,
    masteryRewards: {},
    preparation: null,
    skillStates,
  };
}

function placeBlocks(
  scope: LearnerScope,
  { blocks, session }: { blocks: readonly BuiltBlock[]; session: SeedSession },
) {
  const minutesBefore = (position: number) =>
    blocks.slice(0, position).reduce((sum, block) => sum + block.estimatedMinutes, 0);

  return blocks.map((block, position) => {
    const status = getBlockStatus(session, position);
    const isStarted = status !== "pending";

    return {
      block,
      completedAt:
        status === "completed" ? studyMoment(scope, 0, minutesBefore(position + 1)) : null,
      id: todayBlockId(scope.learner, position),
      position,
      startedAt: isStarted ? studyMoment(scope, 0, minutesBefore(position)) : null,
      status,
    };
  });
}

/** Clears earlier sessions, answers and mocks, so the session builder reads today as it began. */
export async function clearSessions(scope: LearnerScope, goalId: string): Promise<void> {
  const { learner, prisma, userId } = scope;

  const inSession = learner.attempts
    .filter((attempt) => attempt.inSession)
    .map((attempt) => seedId(`learner:${learner.key}:attempt:${attempt.key}`));

  // The seeded session keeps its id from run to run, whatever day an earlier run wrote it on.
  const sessions = { OR: [{ goalId, userId }, { id: todaySessionId(learner) }] };

  // One after the other: deleting the session unlinks its answers, the rows the first delete takes.
  await prisma.attempt.deleteMany({
    where: { OR: [{ id: { in: inSession } }, { studySession: sessions }] },
  });

  await prisma.mockExam.deleteMany({ where: { goalId } });
  await prisma.studySession.deleteMany({ where: sessions });
}

function toBlockAttempts(
  scope: LearnerScope,
  { blocks, sessionId }: { blocks: readonly FinishedBlock[]; sessionId: string },
): Prisma.AttemptCreateManyInput[] {
  const { learner, userId } = scope;

  return blocks.flatMap(({ answers, completedAt, startedAt }) => {
    const step = (completedAt.getTime() - startedAt.getTime()) / (answers.length + 1);

    return answers.map(({ answer, itemId, skillId }, index) => {
      const answeredAt = new Date(startedAt.getTime() + step * (index + 1));

      return {
        answer,
        answeredAt,
        durationMs: Math.round(step),
        isCorrect: true,
        itemId,
        skillId,
        studySessionId: sessionId,
        userId,
        ...localTimeFields(answeredAt, learner.timeZone),
      };
    });
  });
}

/** The id is stable, so each run moves the seeded session to today. */
async function writeDay(
  scope: LearnerScope,
  { day, goalId, session }: { day: BuiltDay; goalId: string; session: SeedSession },
): Promise<FinishedBlock[]> {
  const { learner, prisma, userId } = scope;
  const id = todaySessionId(learner);
  const placed = placeBlocks(scope, { blocks: day.blocks, session });
  const status = getSessionStatus(session, day.blocks);
  const startedAt = status === "planned" ? null : studyMoment(scope, 0);

  const finished = placed.flatMap(({ block, completedAt, position, startedAt: blockStart }) =>
    completedAt && blockStart
      ? [{ ...block, answers: day.answers.get(position) ?? [], completedAt, startedAt: blockStart }]
      : [],
  );

  const brainPower = await writeTodayHistory(scope, { blocks: finished, goalId });
  const earnedToday = brainPower.reduce((sum, earned) => sum + earned, 0);

  await prisma.studySession.create({
    data: {
      endedAt: status === "completed" ? (finished.at(-1)?.completedAt ?? null) : null,
      freshStart: day.freshStart,
      goalId,
      id,
      localDate: scopeDay(scope, 0),
      missions: day.missions,
      planVersion: day.planVersion,
      plannedMinutes: day.blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
      startSnapshot: startedAt ? toStartSnapshot(scope, earnedToday) : Prisma.DbNull,
      startedAt,
      status,
      userId,
    },
  });

  await Promise.all([
    prisma.studySessionBlock.createMany({
      data: placed.map(({ block, id: blockId, position, ...progress }) => ({
        ...block,
        ...progress,
        brainPower: brainPower[position] ?? 0,
        id: blockId,
        position,
        sessionId: id,
      })),
    }),
    writeAttempts(scope, { inSession: true, sessionId: id }),
    prisma.attempt.createMany({
      data: toBlockAttempts(scope, { blocks: finished, sessionId: id }),
    }),
  ]);

  return finished;
}

export function toSeededToday(
  scope: LearnerScope,
  { goalId, session }: { goalId: string; session: SeedSession },
): SeededToday {
  return {
    blockId: (position) => todayBlockId(scope.learner, position),
    localDate: scopeDay(scope, 0),
    now: scope.now,
    timeZone: scope.learner.timeZone,
    write: (day) => writeDay(scope, { day, goalId, session }),
  };
}
