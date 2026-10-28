import "server-only";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import {
  appendExtraBlocks,
  isFreeWeekOver,
  planExtraBlocks,
  withSessionAppendLock,
} from "./_utils/extra-blocks";
import { readBlockLessonStates } from "./_utils/lesson-screens";
import { type StudyBlockView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { readBlockPayload } from "./block-payload";
import { getBlockScreen } from "./day-block";
import { type ExtraTimeReason, getExtraTime } from "./extra-time";
import { getDailyTimeLimitStatus } from "./get-daily-time-limit";

export type ExtraStudyBlockResult =
  | { block: StudyBlockView; status: "ready" }
  | { status: "nothingToPractice" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { reason: ExtraTimeReason; status: "unavailable" };

/** Requires all planned blocks finished; returns the first added block and respects daily limits and free-exam gates. */
export async function addExtraStudyBlock({
  sessionId,
}: {
  sessionId: string;
}): Promise<ExtraStudyBlockResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (await isFreeWeekOver(owned.session)) {
    return { reason: "plusRequired", status: "unavailable" };
  }

  const { userId } = owned;
  const limit = await getDailyTimeLimitStatus();
  const skillIds = owned.session.goalId ? await loadGoalSkillIds(owned.session.goalId) : [];

  const added = await withSessionAppendLock<ExtraStudyBlockResult>({
    run: async ({ session, transaction }) => {
      const extraTime = getExtraTime({
        blocks: session.blocks.map((block) => ({
          extra: readBlockPayload(block).extra,
          kind: block.kind,
          status: block.status,
        })),
        remainingLimitMinutes: limit?.remainingMinutes ?? null,
      });

      if (!extraTime.available || extraTime.reason) {
        return { reason: extraTime.reason ?? "dailyCap", status: "unavailable" };
      }

      const planned = await planExtraBlocks({
        minutes: extraTime.minutes,
        session,
        skillIds,
        userId,
      });

      if ("reason" in planned) {
        return planned.reason === "dailyCap"
          ? { reason: planned.reason, status: "unavailable" }
          : { status: "nothingToPractice" };
      }

      return {
        block: await appendExtraBlocks({ planned: planned.blocks, session, transaction }),
        status: "ready",
      };
    },
    session: owned.session,
  });

  if (added.status !== "ready") {
    return added;
  }

  // Read after the append's lock: where a lesson block plays follows its lesson's state.
  const lessonStates = await readBlockLessonStates([added.block]);
  return { ...added, block: { ...added.block, screen: getBlockScreen(added.block, lessonStates) } };
}
