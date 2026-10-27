import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
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
  /**
   * The plan's version its skip left: its undo holds only while the plan is still there, since a
   * later skip joins the same plan change; null when it skipped none.
   */
  planVersion: number | null;
  total: number;
};

/** The ledger row's ids for a sent test-out: its chapter, its own id (`requestId`) and its outcome. */
export function toTestOutContentIds({
  changeId,
  chapterId,
  lessonsSkipped,
  passed,
  planVersion,
  requestId,
}: {
  changeId: string | null;
  chapterId: string;
  lessonsSkipped: number;
  passed: boolean;
  planVersion: number | null;
  requestId: string;
}): Record<string, string> {
  return {
    chapterId,
    lessonsSkipped: String(lessonsSkipped),
    ...(changeId ? { planChangeId: changeId } : {}),
    ...(planVersion === null ? {} : { planVersion: String(planVersion) }),
    testOutId: requestId,
    testOutPassed: String(passed),
  };
}

function readTestOutReceipt(event: LearningEvent): TestOutReceipt {
  const content = isJsonObject(event.contentIds) ? event.contentIds : {};
  const planVersion = Number(content.planVersion);

  return {
    changeId: typeof content.planChangeId === "string" ? content.planChangeId : null,
    correct: event.correctAnswers,
    lessonsSkipped: Number(content.lessonsSkipped) || 0,
    passed: content.testOutPassed === "true",
    planVersion: Number.isInteger(planVersion) ? planVersion : null,
    total: event.correctAnswers + event.incorrectAnswers,
  };
}

/**
 * The learner's test-out of this goal's chapter sent with this id, if it was; the same id sent for
 * another chapter is that chapter's own test.
 */
export async function findTestOutReceipt({
  chapterId,
  goalId,
  requestId,
  userId,
}: {
  chapterId: string;
  goalId: string;
  requestId: string;
  userId: string;
}): Promise<TestOutReceipt | null> {
  const event = await prisma.learningEvent.findFirst({
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
