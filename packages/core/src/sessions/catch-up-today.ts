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
  | { status: "nothingToCatchUp" | "notFound" | "unauthorized" };

/**
 * "Catch up today": the lessons earlier days left that the day's normal time didn't fit join the
 * end of today's session, in plan order, so the learner is back on pace once they're done. Without
 * the tap they come first on the next days. A day already done opens again, as "10 more minutes"
 * does.
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

  const added = await withSessionAppendLock({
    run: async ({ session, transaction }) => {
      const { lessons } = await loadLaterCatchUp({
        blocks: session.blocks,
        goalId: session.goalId,
        userId,
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

  const timeZone = getAnswerTimeZone({ goal: fresh.session.goal, timeZone: input.timeZone });

  return {
    session: await loadStudySessionView({ session: fresh.session, timeZone, userId }),
    status: "ready",
  };
}
