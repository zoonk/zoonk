import { prisma } from "@zoonk/db";
import { applySessionProgress } from "../sessions/_utils/session-progress";
import { getAnswersEnergyDelta } from "../sessions/brain-power";
import { getCompletionEnergyContext } from "./completion-energy";
import { recordLearningEvent } from "./record-learning-event";

const MS_PER_SECOND = 1000;

/**
 * One question counts at most this long toward study time: answering one takes seconds to a
 * minute or two, so a question left open while the learner was away doesn't count as study.
 */
const MAX_QUESTION_SECONDS = 300;

type AnsweredQuestion = { durationMs: number; isCorrect: boolean };

/** The time the learner spent answering, each question counted up to `MAX_QUESTION_SECONDS`. */
function getAnsweringSeconds(answers: readonly AnsweredQuestion[]): number {
  return Math.round(
    answers.reduce(
      (total, answer) => total + Math.min(answer.durationMs / MS_PER_SECOND, MAX_QUESTION_SECONDS),
      0,
    ),
  );
}

/**
 * Adds a set of questions the learner answered outside lessons and sessions (a chapter's
 * test-out, a focus test, a language's level test) to their day: its answering time, its answers, the Energy answers give
 * and a row in the ledger, so Activity and Statistics count every minute they studied. It earns
 * no Brain Power: it tests what the learner knows rather than teaching it.
 */
export async function recordAnsweredActivity({
  answers,
  contentIds,
  goalId,
  lessonKind,
  timeZone,
  userId,
}: {
  answers: readonly AnsweredQuestion[];
  contentIds: Record<string, string>;
  goalId: string;
  lessonKind: "focusTest" | "levelTest" | "testOut";
  timeZone: string;
  userId: string;
}): Promise<void> {
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const incorrect = answers.length - correct;
  const seconds = getAnsweringSeconds(answers);
  const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

  await prisma.$transaction(async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    await applySessionProgress(tx, {
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

    await recordLearningEvent(tx, {
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
  });
}
