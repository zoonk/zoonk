import "server-only";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { isCurrentSession } from "./_utils/current-session";
import {
  appendExtraBlocks,
  isFreeWeekOver,
  planExtraBlocks,
  withSessionAppendLock,
} from "./_utils/extra-blocks";
import { readBlockLessonStates } from "./_utils/lesson-screens";
import { type StudyBlockView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";
import { getBlockScreen } from "./day-block";
import { type ExtraTimeReason, getExtraTime } from "./extra-time";

export type ExtraStudyBlockResult =
  | { block: StudyBlockView; status: "ready" }
  | { status: "nothingToPractice" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { reason: ExtraTimeReason; status: "unavailable" };

/**
 * Adds to the learner's current day only, once its planned blocks are finished; returns the first
 * added block and respects free-exam gates.
 */
export async function addExtraStudyBlock({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<ExtraStudyBlockResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: owned.session.goal, timeZone: input.timeZone });
  const skillIds = owned.session.goalId ? await loadGoalSkillIds(owned.session.goalId) : [];

  const added = await withSessionAppendLock<ExtraStudyBlockResult>({
    run: async ({ session, transaction }) => {
      const extraTime = getExtraTime({
        blocks: session.blocks,
        current: isCurrentSession({ now: new Date(), session, timeZone }),
      });

      if (!extraTime.available) {
        return { reason: extraTime.reason, status: "unavailable" };
      }

      if (await isFreeWeekOver(session)) {
        return { reason: "plusRequired", status: "unavailable" };
      }

      const planned = await planExtraBlocks({
        minutes: extraTime.minutes,
        session,
        skillIds,
        userId,
      });

      if (!planned) {
        return { status: "nothingToPractice" };
      }

      return { block: await appendExtraBlocks({ planned, session, transaction }), status: "ready" };
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
