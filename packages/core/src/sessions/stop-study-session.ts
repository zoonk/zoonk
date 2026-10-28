import "server-only";
import { after } from "next/server";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { scheduleMemoryAfterSession } from "../memory/after-session";
import { rebalancePlanAfterSession } from "../preparation/rebalance-plan";
import { refreshPlanAroundSession } from "./_utils/refresh-plan";
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

/** Keep unfinished lessons and partial duels open; score only work already completed. */
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

/** Returns true only to the request that records the first stop. */
function markFirstStop({ sessionId, userId }: { sessionId: string; userId: string }) {
  return writeLearnerChange({ userId }, async (tx) => {
    const { count } = await tx.studySession.updateMany({
      data: { stoppedAt: new Date() },
      where: { id: sessionId, stoppedAt: null },
    });

    return count > 0 ? true : unchanged(false);
  });
}

/** Requires ownership; preserves unfinished work for resumption and schedules memory/rebalance only on the first stop. */
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

  // Completion already schedules memory; repeated stops must not run another model.
  if (!settled.sessionCompleted && (await markFirstStop({ sessionId: session.id, userId }))) {
    scheduleMemoryAfterSession({ goalId: session.goalId, sessionId: session.id, timeZone, userId });

    const refreshed = await refreshPlanAroundSession({ goalId: session.goalId, pace: "sampled" });

    if (refreshed) {
      after(() => rebalancePlanAfterSession({ goalId: session.goalId, userId }));
    }
  }

  return getStudySessionSummary({ input, sessionId });
}
