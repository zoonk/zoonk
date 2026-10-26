import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { type CheckpointOutcome } from "../checkpoints/_utils/checkpoint-outcome";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { completeBlockMoment } from "./_utils/block-completion";
import { finishEmptyCheckpoint } from "./_utils/finish-empty-checkpoint";
import {
  findLessonFinish,
  getLessonComesBack,
  markLessonBlockDone,
  readFinishedLessonId,
} from "./_utils/lesson-block";
import { getNetScore, getNetScoredItemIds } from "./_utils/net-score";
import { trackBlockCompleted } from "./_utils/session-events";
import { gradeSessionAnswer, parseSessionItem, readRecordedAnswer } from "./_utils/session-items";
import { type ProgressChange } from "./_utils/session-progress";
import {
  type QuestionBlockSettlement,
  countOpenedCapsules,
  prepareQuestionBlock,
  settleQuestionBlock,
} from "./_utils/settle-question-block";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { findTestOutOffer } from "./_utils/test-out-offer";
import { readBlockPayload } from "./block-payload";
import { type CheckpointResultView, type StudyBlockCompletion } from "./completion-contract";
import { type StudySessionTimeZoneInput } from "./contract";
import { type MissionCompletionSource } from "./missions/settle-missions";

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

/**
 * A question block's settlement, made now or read back: one settled before (a retry) has no
 * Energy change, since what it reached was this block's to celebrate when it was settled.
 */
type SettledQuestionBlock =
  | {
      settlement: Omit<QuestionBlockSettlement, "energy" | "seconds"> & {
        energy: ProgressChange | null;
      };
      status: "ready";
    }
  | { status: "blockFinished" };

/**
 * A mock's block is finished by its mock, so what finishing it does to the day's missions (the
 * mock's mission, the bonus when it was the last) is the mock's to say on its result, on every read
 * of it that day (see `loadMockMissionMoment`). Other blocks say it in their own completion.
 */
async function findMissionSource(
  block: StudySessionBlock,
): Promise<MissionCompletionSource | undefined> {
  if (!readBlockPayload(block).checkpoint?.mock) {
    return undefined;
  }

  const mock = await prisma.mockExam.findUnique({
    select: { id: true },
    where: { blockId: block.id },
  });

  return mock ? { id: mock.id, kind: "mockExam" } : undefined;
}

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

/**
 * A block settled before, read back for a retry whose first response was lost: its answers scored
 * the same way and the Brain Power its settlement paid and kept. Nothing is written or paid again.
 */
async function readSettledQuestionBlock(owned: OwnedBlock): Promise<SettledQuestionBlock> {
  const prepared = await prepareQuestionBlock(owned);
  const reward = readBlockPayload(owned.block).milestoneReward;

  if (typeof prepared === "string" || !reward) {
    return { status: "blockFinished" };
  }

  return {
    settlement: {
      answers: prepared.own,
      brainPower: owned.block.brainPower,
      brainPowerBefore: reward.brainPower.before,
      capsulesOpened: countOpenedCapsules(prepared),
      checkpoint: prepared.checkpoint,
      correct: prepared.correct,
      energy: null,
      topHyperdrive: prepared.scored.topLevel,
      total: prepared.own.length,
    },
    status: "ready",
  };
}

/**
 * Scores and settles the block, then builds its moment. A block settled before (a retry after the
 * response was lost, or after a later stage failed) is read back instead: the same moment, with the
 * day's settlement and milestone writes resumed and nothing paid twice.
 */
async function finishQuestionBlock(
  owned: OwnedBlock & { source?: MissionCompletionSource },
): Promise<FinishStudyBlockResult> {
  const settled =
    owned.block.status === "completed"
      ? await readSettledQuestionBlock(owned)
      : await settleQuestionBlock(owned);

  if (settled.status === "emptyCheckpoint") {
    return finishEmptyCheckpoint(owned);
  }

  if (settled.status !== "ready") {
    return settled;
  }

  const { settlement } = settled;
  const payload = readBlockPayload(owned.block);

  const answeredItemIds = settlement.answers.flatMap((answer) =>
    answer.itemId ? [answer.itemId] : [],
  );

  // Only statements (swipe capsules, net-scored practice) count in the net; a matching question in
  // the same review is right or wrong on its own.
  const netItemIds = new Set(getNetScoredItemIds([owned.block]));
  const answeredNetItemIds = answeredItemIds.filter((itemId) => netItemIds.has(itemId));

  const [checkpoint, netScore] = await Promise.all([
    toCheckpointResult({
      blockId: owned.block.id,
      checkpoint: settlement.checkpoint,
      itemIds: answeredItemIds,
      sessionId: owned.session.id,
      userId: owned.userId,
    }),
    netItemIds.size > 0
      ? getNetScore({
          itemIds: answeredNetItemIds,
          sessionId: owned.session.id,
          userId: owned.userId,
        })
      : null,
  ]);

  const completion = await completeBlockMoment({
    blockId: owned.block.id,
    brainPowerBefore: settlement.brainPowerBefore,
    energy: settlement.energy,
    payload,
    result: {
      brainPower: settlement.brainPower,
      capsulesOpened: settlement.capsulesOpened,
      checkpoint,
      comesBackOn: null,
      correct: settlement.correct,
      netScore,
      testOutOffer: null,
      topHyperdrive: settlement.topHyperdrive,
      total: settlement.total,
    },
    sessionId: owned.session.id,
    source: owned.source,
    timeZone: owned.timeZone,
    userId: owned.userId,
  });

  return { completion, status: "ready" };
}

/**
 * Finishes a learn block once its lesson was finished: the lesson's own completion already paid
 * its Brain Power and Energy (`energy`, when that completion is this request), so the block
 * records it, checks the lesson off in the plan and settles the day. The lesson's time is the
 * block's. Finishing it again returns the same moment.
 */
export async function finishLessonBlock({
  energy = null,
  ...owned
}: OwnedBlock & {
  /** Energy before and after the lesson, when its completion just added it. */
  energy?: ProgressChange | null;
}): Promise<FinishStudyBlockResult> {
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

  const { goalId } = owned.session;

  const [comesBackOn, testOutOffer] = await Promise.all([
    getLessonComesBack({
      lessonId,
      targetDate: owned.session.goal?.targetDate ?? null,
      timeZone: owned.timeZone,
      userId: owned.userId,
    }),
    lessonId && goalId ? findTestOutOffer({ goalId, lessonId, userId: owned.userId }) : null,
  ]);

  const completion = await completeBlockMoment({
    blockId: owned.block.id,
    brainPowerBefore: Number(progress?.totalBrainPower ?? 0) - finish.brainPower,
    energy,
    payload: readBlockPayload(owned.block),
    result: {
      brainPower: finish.brainPower,
      capsulesOpened: 0,
      checkpoint: null,
      comesBackOn,
      correct: finish.correctAnswers,
      netScore: null,
      testOutOffer,
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

  const source = await findMissionSource(owned.block);

  if (owned.block.status === "skipped") {
    if (readBlockPayload(owned.block).checkpointAbandoned) {
      return finishEmptyCheckpoint(context);
    }

    return { status: "blockFinished" };
  }

  return finishQuestionBlock({ ...context, source });
}
