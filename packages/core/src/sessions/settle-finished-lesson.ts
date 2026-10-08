import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { finishExplanations } from "../goals/_utils/finish-explanations";
import { isCurrentSession } from "./_utils/current-session";
import { completeLessonPlanItems, scheduleLessonCanDos } from "./_utils/plan-items";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type StudyBlockCompletion } from "./completion-contract";
import { finishLessonBlock } from "./finish-study-block";

/**
 * The learn block of the learner's day for a lesson: in today's session or the one they're still
 * in from before midnight, the block they opened first, or the one already done when the same
 * finish is settled again (a retried completion gets its moment back).
 */
async function findDayLessonBlock({
  lessonId,
  timeZone,
  userId,
}: {
  lessonId: string;
  timeZone: string;
  userId: string;
}) {
  const now = new Date();
  const today = getDateInTimeZone({ date: now, timeZone });

  const blocks = await prisma.studySessionBlock.findMany({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    orderBy: [{ completedAt: { nulls: "first", sort: "desc" } }, { position: "asc" }],
    where: {
      kind: "learn",
      lessonId,
      session: { localDate: { in: [today, new Date(today.getTime() - MS_PER_DAY)] }, userId },
      status: { in: ["active", "pending", "completed"] },
    },
  });

  const current = blocks.filter((block) =>
    isCurrentSession({ now, session: block.session, timeZone }),
  );

  return current.find((block) => block.status === "active") ?? current[0] ?? null;
}

/**
 * What a finished lesson means for the learner's plan and day, called by the lesson player's
 * completion right after it closes the lesson's ledger row (`contentIds.lessonId`): the lesson is
 * checked off in every plan that has it (a quick explanation's lesson finishes the explanation),
 * and when it is one of the day's session blocks (today's, or the session the learner is still in
 * from before midnight) the block is done, the day is settled (missions, the full meal, the
 * session's end, milestones) and the block's completion moment comes back, so the player shows it
 * without another request. Null for a lesson played outside the day's session.
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

  const [found] = await Promise.all([
    findDayLessonBlock({ lessonId, timeZone, userId }),
    finishExplanations({ lessonId, userId }),
  ]);

  if (!found) {
    return null;
  }

  const { session, ...block } = found;
  const result = await finishLessonBlock({ block, session, timeZone, userId });

  return result.status === "ready" ? result.completion : null;
}
