import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readFinishedChapter, toFinishedChapterIds } from "../../../mind-maps/finished-chapters";
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

export function toTestOutContentIds({
  changeId,
  chapterId,
  finishedChapter,
  lessonsSkipped,
  passed,
  planVersion,
  requestId,
}: {
  changeId: string | null;
  chapterId: string;
  finishedChapter: FinishedChapter | null;
  lessonsSkipped: number;
  passed: boolean;
  planVersion: number | null;
  requestId: string;
}): Record<string, string> {
  return {
    ...toFinishedChapterIds(finishedChapter),
    chapterId,
    lessonsSkipped: String(lessonsSkipped),
    ...(changeId ? { planChangeId: changeId } : {}),
    ...(planVersion === null ? {} : { planVersion: String(planVersion) }),
    testOutId: requestId,
    testOutPassed: String(passed),
  };
}

function readTestOutReceipt(event: LearningEvent): Omit<TestOutReceipt, "finishedChapter"> {
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

/** A requestId is scoped to learner, goal, and chapter; another chapter's receipt is not reusable. */
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

  if (!event) {
    return null;
  }

  return {
    ...readTestOutReceipt(event),
    finishedChapter: await readFinishedChapter(event.contentIds),
  };
}
