import "server-only";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadLaterCatchUp } from "./_utils/catch-up";
import { withSessionAppendLock } from "./_utils/extra-blocks";
import { loadStudySessionView } from "./_utils/load-session-view";
import { type StudySessionView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";
import { toLessonBlock } from "./session-builder";

export type CatchUpTodayResult =
  | { session: StudySessionView; status: "ready" }
  | { status: "nothingToCatchUp" | "notFound" | "plusRequired" | "unauthorized" };

/**
 * "Catch up today": the lessons earlier days left that the day's normal time didn't fit join the
 * end of today's session, in plan order, so the learner is back on pace once they're done. Without
 * the tap they come first on the next days. A day already done opens again, as "10 more minutes"
 * does. Only while the day offers it (`CatchUpView.later.offered`): more than about one more day's
 * time or a fresh start leaves them to the next days, and past a free exam plan's first week new
 * lessons, these too, come with Plus.
 */
export async function catchUpToday({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<CatchUpTodayResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: owned.session.goal, timeZone: input.timeZone });
  const day = await loadStudySessionView({ session: owned.session, timeZone, userId });

  if (day.examAccess.trialEnded) {
    return { status: "plusRequired" };
  }

  if (!day.catchUp?.later.offered) {
    return { status: "nothingToCatchUp" };
  }

  const added = await withSessionAppendLock({
    run: async ({ session, transaction }) => {
      const { lessons } = await loadLaterCatchUp({
        blocks: session.blocks,
        goalId: session.goalId,
      });

      if (lessons.length === 0) {
        return false;
      }

      const first = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;
      const planned = lessons.map((lesson) => toLessonBlock(lesson, false));

      await transaction.studySessionBlock.createMany({
        data: planned.map((block, index) => ({
          ...block,
          position: first + index,
          sessionId: session.id,
        })),
      });

      await transaction.studySession.update({
        data: {
          plannedMinutes:
            session.plannedMinutes +
            planned.reduce((sum, block) => sum + block.estimatedMinutes, 0),
          status: "active",
        },
        where: { id: session.id },
      });

      return true;
    },
    session: owned.session,
  });

  if (!added) {
    return { status: "nothingToCatchUp" };
  }

  const fresh = await findOwnedStudySession(sessionId);

  if (fresh.status !== "ready") {
    return fresh;
  }

  return {
    session: await loadStudySessionView({ session: fresh.session, timeZone, userId }),
    status: "ready",
  };
}
