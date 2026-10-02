import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { type CheckpointOutcome } from "../checkpoints/_utils/checkpoint-outcome";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { completeBlockMoment } from "./_utils/block-completion";
import {
  findLessonFinish,
  getLessonComesBack,
  markLessonBlockDone,
  readFinishedLessonId,
} from "./_utils/lesson-block";
import { trackBlockCompleted } from "./_utils/session-events";
import { gradeSessionAnswer, parseSessionItem, readRecordedAnswer } from "./_utils/session-items";
import { settleQuestionBlock } from "./_utils/settle-question-block";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { readBlockPayload } from "./block-payload";
import { type CheckpointResultView, type StudyBlockCompletion } from "./completion-contract";
import { type StudySessionTimeZoneInput } from "./contract";

export type FinishStudyBlockResult =
  | { completion: StudyBlockCompletion; status: "ready" }
  | { status: "blockFinished" }
  | { status: "lessonNotFinished" }
  | { status: "noAnswers" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unanswered" };

type OwnedBlock = {
  block: StudySessionBlock;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
};

/** Now the duel is over: each question's right answer and why, the traps included. */
async function toCheckpointResult({
  blockId,
  checkpoint,
  itemIds,
  sessionId,
  userId,
}: {
  blockId: string;
  checkpoint: CheckpointOutcome | null;
  itemIds: string[];
  sessionId: string;
  userId: string;
}): Promise<CheckpointResultView | null> {
  if (!checkpoint) {
    return null;
  }

  const [items, attempts] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: itemIds } } }),
    prisma.attempt.findMany({
      select: { answer: true, isCorrect: true, itemId: true },
      where: { itemId: { in: itemIds }, studySessionId: sessionId, userId },
    }),
  ]);

  const answers = attempts.flatMap((attempt) => {
    const row = items.find((item) => item.id === attempt.itemId);
    const item = row ? parseSessionItem(row) : null;
    const answer = readRecordedAnswer(attempt.answer);

    if (!item || !answer) {
      return [];
    }

    const graded = gradeSessionAnswer({ answer, blockId, item });

    return [
      {
        correctAnswer: graded.correctAnswer,
        explanation: graded.explanation,
        isCorrect: attempt.isCorrect,
        itemId: item.id,
        workedSteps: graded.workedSteps,
      },
    ];
  });

  return { ...checkpoint, answers };
}

/** A statement left blank ("I don't know") in a net-scored capsule or practice. */
function isBlankAnswer(answer: unknown): boolean {
  const recorded = readRecordedAnswer(answer);
  return recorded !== null && "dontKnow" in recorded;
}

/**
 * Cebraspe scoring for swipe capsules and net-scored practice: each wrong answer cancels a right
 * one, and a statement left blank counts for neither, which is why leaving it blank is offered.
 */
async function getNetScore({
  itemIds,
  sessionId,
  userId,
}: {
  itemIds: string[];
  sessionId: string;
  userId: string;
}): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    select: { answer: true, isCorrect: true },
    where: { itemId: { in: itemIds }, studySessionId: sessionId, userId },
  });

  const right = attempts.filter((attempt) => attempt.isCorrect).length;
  const blank = attempts.filter((attempt) => !attempt.isCorrect && isBlankAnswer(attempt.answer));

  return right - (attempts.length - right - blank.length);
}

async function finishQuestionBlock(owned: OwnedBlock): Promise<FinishStudyBlockResult> {
  const settled = await settleQuestionBlock(owned);

  if (settled.status !== "ready") {
    return settled;
  }

  const { settlement } = settled;
  const payload = readBlockPayload(owned.block);

  const answeredItemIds = settlement.answers.flatMap((answer) =>
    answer.itemId ? [answer.itemId] : [],
  );

  const netScored =
    payload.netScored || payload.capsules.some((capsule) => capsule.format === "swipe");

  const [checkpoint, netScore] = await Promise.all([
    toCheckpointResult({
      blockId: owned.block.id,
      checkpoint: settlement.checkpoint,
      itemIds: answeredItemIds,
      sessionId: owned.session.id,
      userId: owned.userId,
    }),
    netScored
      ? getNetScore({ itemIds: answeredItemIds, sessionId: owned.session.id, userId: owned.userId })
      : null,
  ]);

  const completion = await completeBlockMoment({
    blockId: owned.block.id,
    brainPowerBefore: settlement.brainPowerBefore,
    payload,
    result: {
      brainPower: settlement.brainPower,
      capsulesOpened: settlement.capsulesOpened,
      checkpoint,
      comesBackOn: null,
      correct: settlement.correct,
      netScore,
      topHyperdrive: settlement.topHyperdrive,
      total: settlement.total,
    },
    sessionId: owned.session.id,
    timeZone: owned.timeZone,
    userId: owned.userId,
  });

  return { completion, status: "ready" };
}

/**
 * Finishes a learn block once its lesson was finished: the lesson's own completion already paid
 * its Brain Power, so the block records it, checks the lesson off in the plan and settles the
 * day. The lesson's time is the block's. Finishing it again returns the same moment.
 */
export async function finishLessonBlock(owned: OwnedBlock): Promise<FinishStudyBlockResult> {
  const finish = await findLessonFinish(owned);

  if (!finish) {
    return { status: "lessonNotFinished" };
  }

  const lessonId = owned.block.lessonId ?? readFinishedLessonId(finish.contentIds);
  const progress = await prisma.userProgress.findUnique({ where: { userId: owned.userId } });

  const done = await markLessonBlockDone({
    block: owned.block,
    brainPower: finish.brainPower,
    lessonId,
    userId: owned.userId,
  });

  if (done) {
    trackBlockCompleted({ block: owned.block, seconds: finish.seconds, session: owned.session });
  }

  const completion = await completeBlockMoment({
    blockId: owned.block.id,
    brainPowerBefore: Number(progress?.totalBrainPower ?? 0) - finish.brainPower,
    payload: readBlockPayload(owned.block),
    result: {
      brainPower: finish.brainPower,
      capsulesOpened: 0,
      checkpoint: null,
      comesBackOn: await getLessonComesBack({
        lessonId,
        timeZone: owned.timeZone,
        userId: owned.userId,
      }),
      correct: finish.correctAnswers,
      netScore: null,
      topHyperdrive: 0,
      total: finish.correctAnswers + finish.incorrectAnswers,
    },
    sessionId: owned.session.id,
    timeZone: owned.timeZone,
    userId: owned.userId,
  });

  return { completion, status: "ready" };
}

/**
 * Finishes one block of the learner's session and returns its completion moment. Question blocks
 * are scored here; learn blocks finish once their lesson was finished in the lesson player.
 */
export async function finishStudyBlock({
  blockId,
  input,
  sessionId,
}: {
  blockId: string;
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<FinishStudyBlockResult> {
  const owned = await findOwnedStudyBlock({ blockId, sessionId });

  if (owned.status !== "ready") {
    return owned;
  }

  const timeZone = getAnswerTimeZone({ goal: owned.session.goal, timeZone: input.timeZone });
  const context = { ...owned, timeZone };

  if (owned.block.kind === "learn") {
    return finishLessonBlock(context);
  }

  if (owned.block.status === "completed" || owned.block.status === "skipped") {
    return { status: "blockFinished" };
  }

  return finishQuestionBlock(context);
}
