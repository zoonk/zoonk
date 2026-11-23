import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readFinishedChapter } from "../../../mind-maps/finished-chapters";
import { type FinishedChapter } from "../../../sessions/completion-contract";

export type TestOutReceipt = {
  /** The plan change that skipped its lessons; null when it skipped none. */
  changeId: string | null;
  correct: number;
  finishedChapter: FinishedChapter | null;
  lessonsSkipped: number;
  passed: boolean;
  /** Undo requires this resulting plan version; null when no lessons were skipped. */
  planVersion: number | null;
  total: number;
};

export async function readTestOutReceipt(event: LearningEvent): Promise<TestOutReceipt> {
  const content = isJsonObject(event.contentIds) ? event.contentIds : {};
  const planVersion = Number(content.planVersion);

  return {
    changeId: typeof content.planChangeId === "string" ? content.planChangeId : null,
    correct: event.correctAnswers,
    finishedChapter: await readFinishedChapter(content),
    lessonsSkipped: Number(content.lessonsSkipped) || 0,
    passed: content.testOutPassed === "true",
    planVersion: Number.isInteger(planVersion) ? planVersion : null,
    total: event.correctAnswers + event.incorrectAnswers,
  };
}

/** A requestId is scoped to learner, goal, and chapter; another chapter's receipt is not reusable. */
export function findTestOutEvent({
  chapterId,
  goalId,
  requestId,
  tx = prisma,
  userId,
}: {
  chapterId: string;
  goalId: string;
  requestId: string;
  tx?: TransactionClient;
  userId: string;
}) {
  return tx.learningEvent.findFirst({
    where: {
      AND: [
        { contentIds: { equals: requestId, path: ["testOutId"] } },
        { contentIds: { equals: chapterId, path: ["chapterId"] } },
      ],
      goalId,
      lessonKind: "testOut",
      userId,
    },
  });
}

export async function findTestOutReceipt(input: Parameters<typeof findTestOutEvent>[0]) {
  const event = await findTestOutEvent(input);

  return event && !(isJsonObject(event.contentIds) && event.contentIds.pendingPlans)
    ? readTestOutReceipt(event)
    : null;
}
