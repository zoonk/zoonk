import { type TransactionClient } from "@zoonk/db";
import {
  type ProgressChange,
  type ProgressLock,
  applySessionProgress,
} from "../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta } from "../../sessions/brain-power";
import { recordLearningEvent } from "../record-learning-event";

const MS_PER_SECOND = 1000;

/** Questions left open while the learner was away do not count the whole absence as study. */
const MAX_QUESTION_SECONDS = 300;

export type AnsweredActivity = {
  answers: readonly { durationMs: number; isCorrect: boolean }[];
  contentIds: Record<string, string>;
  goalId: string;
  lessonKind: "focusTest" | "levelTest" | "testOut";
  timeZone: string;
  userId: string;
};

/**
 * Records answers under the owner's progress lock, in the caller's settlement transaction, and
 * returns the Brain Power and Energy before and after them.
 */
export async function settleAnsweredActivity(
  transaction: TransactionClient,
  {
    answers,
    contentIds,
    goalId,
    lessonKind,
    lock,
    timeZone,
    userId,
  }: AnsweredActivity & { lock: ProgressLock },
): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const incorrect = answers.length - correct;

  const seconds = Math.round(
    answers.reduce(
      (total, answer) => total + Math.min(answer.durationMs / MS_PER_SECOND, MAX_QUESTION_SECONDS),
      0,
    ),
  );

  const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

  const progress = await applySessionProgress(transaction, {
    completion: true,
    delta: {
      brainPower: 0,
      correctAnswers: correct,
      energyDelta,
      incorrectAnswers: incorrect,
      seconds,
    },
    lock,
    userId,
  });

  await recordLearningEvent(transaction, {
    brainPower: 0,
    contentIds,
    correctAnswers: correct,
    endedAt: lock.completedAt,
    energyDelta,
    goalId,
    incorrectAnswers: incorrect,
    kind: "questions",
    lessonKind,
    seconds,
    startedAt: new Date(lock.completedAt.getTime() - seconds * MS_PER_SECOND),
    timeZone,
    titleSnapshot: null,
    userId,
  });

  return progress;
}
