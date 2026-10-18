import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { CAPSULE_LEDGER_KIND } from "../../../milestones/award-milestones";
import { getStartOfLocalDay } from "../../_utils/local-time";
import { TEST_OUT_MIN_QUESTIONS, TEST_OUT_PASS_MARK } from "../test-out-rules";

/** Failed tests written before the outcome snapshot use their recorded score. */
function failedTest(event: {
  contentIds: unknown;
  correctAnswers: number;
  incorrectAnswers: number;
}) {
  const content = isJsonObject(event.contentIds) ? event.contentIds : {};

  if (content.testOutPassed === "false") {
    return true;
  }

  if (content.testOutPassed === "true") {
    return false;
  }

  const total = event.correctAnswers + event.incorrectAnswers;

  return total < TEST_OUT_MIN_QUESTIONS || event.correctAnswers / total < TEST_OUT_PASS_MARK;
}

/**
 * A failed chapter test waits until the learner studies a lesson there or their next local day.
 * Session, chapter, language-unit and new Buddy offers share this rule; direct test access stays open.
 */
export async function loadBlockedTestOutChapters({
  chapterIds,
  goalId,
  now,
  timeZone,
  userId,
}: {
  chapterIds: readonly string[];
  goalId: string;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<Set<string>> {
  if (chapterIds.length === 0) {
    return new Set();
  }

  const start = getStartOfLocalDay({
    localDate: getDateInTimeZone({ date: now, timeZone }),
    timeZone,
  });

  const tests = await prisma.learningEvent.findMany({
    orderBy: { endedAt: "desc" },
    where: {
      OR: chapterIds.map((chapterId) => ({
        contentIds: { equals: chapterId, path: ["chapterId"] },
      })),
      endedAt: { gte: start, lte: now },
      goalId,
      lessonKind: "testOut",
      userId,
    },
  });

  const failed = tests.filter((event) => failedTest(event));

  if (failed.length === 0) {
    return new Set();
  }

  const [plannedLessons, chapterLessons] = await Promise.all([
    prisma.planItem.findMany({
      select: { chapterId: true, lessonId: true },
      where: { chapterId: { in: [...chapterIds] }, lessonId: { not: null }, plan: { goalId } },
    }),
    prisma.chapterLesson.findMany({ where: { chapterId: { in: [...chapterIds] } } }),
  ]);

  const lessons = [...plannedLessons, ...chapterLessons];
  const lessonIds = [...new Set(lessons.flatMap((lesson) => lesson.lessonId ?? []))];

  const studied =
    lessonIds.length === 0
      ? []
      : await prisma.learningEvent.findMany({
          where: {
            AND: [
              {
                OR: lessonIds.map((lessonId) => ({
                  contentIds: { equals: lessonId, path: ["lessonId"] },
                })),
              },
              { OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }] },
            ],
            endedAt: { gte: start, lte: now },
            kind: { in: ["lesson", "review"] },
            userId,
          },
        });

  return new Set(
    chapterIds.filter((chapterId) => {
      const lastFailure = failed.find(
        (event) => isJsonObject(event.contentIds) && event.contentIds.chapterId === chapterId,
      );

      if (!lastFailure?.endedAt) {
        return false;
      }

      const failedAt = lastFailure.endedAt;

      const ids = new Set(
        lessons
          .filter((lesson) => lesson.chapterId === chapterId)
          .flatMap((lesson) => lesson.lessonId ?? []),
      );

      return !studied.some(
        (event) =>
          event.endedAt &&
          event.endedAt > failedAt &&
          isJsonObject(event.contentIds) &&
          typeof event.contentIds.lessonId === "string" &&
          ids.has(event.contentIds.lessonId),
      );
    }),
  );
}
