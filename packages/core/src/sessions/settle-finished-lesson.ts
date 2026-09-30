import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { completeLessonPlanItems, scheduleLessonCanDos } from "./_utils/plan-items";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type StudyBlockCompletion } from "./completion-contract";
import { finishLessonBlock } from "./finish-study-block";

/**
 * Today's learn block for a lesson: an open one first, or the one already done when the same
 * finish is settled again (a retried completion gets its moment back).
 */
function findTodayLessonBlock({
  lessonId,
  timeZone,
  userId,
}: {
  lessonId: string;
  timeZone: string;
  userId: string;
}) {
  return prisma.studySessionBlock.findFirst({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    orderBy: [{ completedAt: { nulls: "first", sort: "desc" } }, { position: "asc" }],
    where: {
      kind: "learn",
      lessonId,
      session: { localDate: getDateInTimeZone({ date: new Date(), timeZone }), userId },
      status: { in: ["active", "pending", "completed"] },
    },
  });
}

/**
 * What a finished lesson means for the learner's plan and day, called by the lesson player's
 * completion right after it closes the lesson's ledger row (`contentIds.lessonId`): the lesson is
 * checked off in every plan that has it, and when it is one of today's session blocks the block is
 * done, the day is settled (missions, the full meal, the session's end, milestones) and the block's
 * completion moment comes back, so the player shows it without another request. Null for a lesson
 * played outside today's session.
 *
 * Internal: the lesson player's completion derives `userId` from the session first.
 */
export async function settleFinishedLesson({
  lessonId,
  timeZone,
  userId,
}: {
  lessonId: string;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion | null> {
  const languageGoals = await prisma.$transaction((tx) =>
    completeLessonPlanItems(tx, { lessonId, now: new Date(), userId }),
  );

  scheduleLessonCanDos({ goals: languageGoals, lessonId, userId });

  const found = await findTodayLessonBlock({ lessonId, timeZone, userId });

  if (!found) {
    return null;
  }

  const { session, ...block } = found;
  const result = await finishLessonBlock({ block, session, timeZone, userId });

  return result.status === "ready" ? result.completion : null;
}
