import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

/**
 * What a sent test-out said, as its ledger row keeps it: its score, whether it passed, and the plan
 * change that skipped its lessons with the lessons its result counted. A retry of the same test
 * and its result's page say it again from here.
 */
export type TestOutReceipt = {
  /** The plan change that skipped its lessons; null when it skipped none. */
  changeId: string | null;
  correct: number;
  lessonsSkipped: number;
  passed: boolean;
  total: number;
};

/** The ledger row's ids for a sent test-out: its chapter, its own id (`requestId`) and its outcome. */
export function toTestOutContentIds({
  changeId,
  chapterId,
  lessonsSkipped,
  passed,
  requestId,
}: {
  changeId: string | null;
  chapterId: string;
  lessonsSkipped: number;
  passed: boolean;
  requestId: string;
}): Record<string, string> {
  return {
    chapterId,
    lessonsSkipped: String(lessonsSkipped),
    ...(changeId ? { planChangeId: changeId } : {}),
    testOutId: requestId,
    testOutPassed: String(passed),
  };
}

function readTestOutReceipt(event: LearningEvent): TestOutReceipt {
  const content = isJsonObject(event.contentIds) ? event.contentIds : {};

  return {
    changeId: typeof content.planChangeId === "string" ? content.planChangeId : null,
    correct: event.correctAnswers,
    lessonsSkipped: Number(content.lessonsSkipped) || 0,
    passed: content.testOutPassed === "true",
    total: event.correctAnswers + event.incorrectAnswers,
  };
}

/**
 * The learner's test-out of this goal's chapter sent with this id, if it was; the same id sent for
 * another chapter is that chapter's own test. `client` reads inside a transaction.
 */
export async function findTestOutReceipt({
  chapterId,
  client = prisma,
  goalId,
  requestId,
  userId,
}: {
  chapterId: string;
  client?: TransactionClient;
  goalId: string;
  requestId: string;
  userId: string;
}): Promise<TestOutReceipt | null> {
  const event = await client.learningEvent.findFirst({
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

  return event ? readTestOutReceipt(event) : null;
}
