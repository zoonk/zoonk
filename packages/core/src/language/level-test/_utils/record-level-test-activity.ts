import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type ProgressLock } from "../../../sessions/_utils/session-progress";
import { settleAnsweredActivity } from "../../../stats/_utils/settle-answered-activity";
import {
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestQuestion,
} from "../level-test-contract";
import { getAnswerVerdict } from "../level-test-rules";

function isAnsweredRight({
  answer,
  question,
}: {
  answer: LevelTestProgress["answers"][number];
  question?: LevelTestQuestion;
}): boolean | null {
  return question ? getAnswerVerdict({ answer, question }) === true : null;
}

export async function recordLevelTestActivity({
  bank,
  goalId,
  lock,
  progress,
  timeZone,
  transaction,
  userId,
}: {
  bank: LevelTestBank;
  goalId: string;
  lock: ProgressLock;
  progress: LevelTestProgress;
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}) {
  const asked = new Map(bank.questions.map((question) => [question.id, question]));
  const confirmations = new Set((bank.confirmations ?? []).map(({ id }) => id));
  const fresh = progress.answers.slice(progress.counted).filter((answer) => !answer.skipped);

  if (fresh.length === 0) {
    return;
  }

  await settleAnsweredActivity(transaction, {
    answers: fresh.map((answer) => ({
      durationMs: answer.durationMs,
      isCorrect: confirmations.has(answer.id)
        ? answer.correct === true
        : isAnsweredRight({ answer, question: asked.get(answer.id) }),
    })),
    contentIds: {},
    goalId,
    lessonKind: "levelTest",
    lock,
    timeZone,
    userId,
  });
}
