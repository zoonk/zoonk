import "server-only";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { getDailyTimeLimitStatus } from "../minors/get-daily-time-limit";
import {
  appendExtraBlock,
  buildExtraLesson,
  buildExtraPractice,
  withSessionAppendLock,
} from "./_utils/extra-blocks";
import { type StudyBlockView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { readBlockPayload } from "./block-payload";
import { type ExtraTimeReason, getExtraTime } from "./extra-time";

export type ExtraStudyBlockResult =
  | { block: StudyBlockView; status: "ready" }
  | { status: "nothingToPractice" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { reason: ExtraTimeReason; status: "unavailable" };

/**
 * "10 more minutes" after the day's session: one bonus block of mixed practice (or the next
 * lesson when there's nothing to practice), offered only after the planned blocks are done, at
 * most twice a day, and never past a guardian's daily limit. Its Brain Power is capped.
 */
export async function addExtraStudyBlock({
  sessionId,
}: {
  sessionId: string;
}): Promise<ExtraStudyBlockResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { userId } = owned;
  const limit = await getDailyTimeLimitStatus();
  const skillIds = owned.session.goalId ? await loadGoalSkillIds(owned.session.goalId) : [];

  return withSessionAppendLock({
    run: async ({ session, transaction }) => {
      const extraTime = getExtraTime({
        blocks: session.blocks.map((block) => ({
          extra: readBlockPayload(block).extra,
          status: block.status,
        })),
        remainingLimitMinutes: limit?.remainingMinutes ?? null,
      });

      if (!extraTime.available || extraTime.reason) {
        return { reason: extraTime.reason ?? "dailyCap", status: "unavailable" };
      }

      const planned =
        (await buildExtraPractice({ minutes: extraTime.minutes, session, skillIds, userId })) ??
        (await buildExtraLesson({ session, userId }));

      if (!planned) {
        return { status: "nothingToPractice" };
      }

      return { block: await appendExtraBlock({ planned, session, transaction }), status: "ready" };
    },
    session: owned.session,
  });
}
