import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { scheduleMemoryAfterSession } from "../memory/after-session";
import { rebalancePlanAfterSession } from "../preparation/rebalance-plan";
import { settleQuestionBlock } from "./_utils/settle-question-block";
import { settleSessionDay } from "./_utils/settle-session-day";
import { type StudySessionRow, findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";
import { finishLessonBlock } from "./finish-study-block";
import {
  type StudySessionSummaryResult,
  getStudySessionSummary,
} from "./get-study-session-summary";

type StopContext = { session: StudySessionRow; timeZone: string; userId: string };

/**
 * A block in progress keeps what was already done: answered questions are scored and a lesson
 * finished in the player counts. A lesson not finished yet and a duel left halfway stay open, so
 * they pick up where the learner left them.
 */
async function settleActiveBlocks({ session, timeZone, userId }: StopContext) {
  const active = session.blocks.filter((block) => block.status === "active");

  await Promise.all(
    active.map((block) =>
      block.kind === "learn"
        ? finishLessonBlock({ block, session, timeZone, userId })
        : settleQuestionBlock({ block, session, timeZone, userId }),
    ),
  );
}

/** Records the session's first stop; true only for the request that recorded it. */
async function markFirstStop(sessionId: string): Promise<boolean> {
  const { count } = await prisma.studySession.updateMany({
    data: { stoppedAt: new Date() },
    where: { id: sessionId, stoppedAt: null },
  });

  return count > 0;
}

/**
 * "Stop for today": whatever was done counts (partial days are days studied) and the summary says
 * what changed so far. Nothing is skipped: the rest of the session waits on Today, so the learner
 * can pick it up later the same day, and tomorrow's plan moves on without it. The session ends
 * only once its blocks are done. Memory reads the day now and the plan gets its weekly rebalance,
 * since the learner may not come back (once a session: the first stop records `stoppedAt`): a
 * session left stopped stays unfinished (its day counts as studied, not as its goal reached), and
 * the next day's session re-flows what it left undone.
 */
export async function stopStudySession({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StudySessionSummaryResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  await settleActiveBlocks({ session, timeZone, userId });
  const settled = await settleSessionDay({ sessionId: session.id, timeZone, userId });

  // A session the stop finished already had memory read it and the plan rebalanced as it completed.
  // Otherwise the first stop does it, once: stopping again (or a client looping) runs no model.
  if (!settled.sessionCompleted && (await markFirstStop(session.id))) {
    scheduleMemoryAfterSession({ goalId: session.goalId, sessionId: session.id, timeZone, userId });
    await rebalancePlanAfterSession({ goalId: session.goalId, userId });
  }

  return getStudySessionSummary({ input, sessionId });
}
