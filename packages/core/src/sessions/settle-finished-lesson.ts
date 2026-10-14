import "server-only";
import { prisma } from "@zoonk/db";
import { finishExplanations } from "../goals/_utils/finish-explanations";
import { findDayLessonBlock } from "./_utils/day-lesson-block";
import { completeLessonPlanItems, scheduleLessonCanDos } from "./_utils/plan-items";
import { type StudyBlockCompletion } from "./completion-contract";
import { finishLessonBlock } from "./finish-study-block";

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
  blockId,
  lessonId,
  timeZone,
  userId,
}: {
  blockId?: string;
  lessonId: string;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion | null> {
  const languageGoals = await prisma.$transaction((tx) =>
    completeLessonPlanItems(tx, { lessonId, now: new Date(), userId }),
  );

  scheduleLessonCanDos({ goals: languageGoals, lessonId, userId });

  const [found] = await Promise.all([
    findDayLessonBlock({ blockId, lessonId, timeZone, userId }),
    finishExplanations({ lessonId, userId }),
  ]);

  if (!found) {
    return null;
  }

  const { session, ...block } = found;
  const result = await finishLessonBlock({ block, session, timeZone, userId });

  return result.status === "ready" ? result.completion : null;
}
