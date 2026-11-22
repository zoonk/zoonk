import "server-only";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { isCurrentSession } from "./_utils/current-session";
import { appendExtraBlocks, planExtraBlocks, withSessionAppendLock } from "./_utils/extra-blocks";
import { readBlockLessonStates } from "./_utils/lesson-screens";
import { loadPreparingMockPositions } from "./_utils/preparing-mock-blocks";
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
 * Adds to the learner's current day only, once its planned blocks are finished (a mock still being
 * prepared aside); returns the first added block.
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

  const [skillIds, preparing] = await Promise.all([
    owned.session.goalId ? loadGoalSkillIds(owned.session.goalId) : [],
    loadPreparingMockPositions(owned.session),
  ]);

  const added = await withSessionAppendLock<ExtraStudyBlockResult>({
    run: async ({ session, transaction }) => {
      const extraTime = getExtraTime({
        blocks: session.blocks.map((block) => ({
          preparing: preparing.has(block.position),
          status: block.status,
        })),
        current: isCurrentSession({ now: new Date(), session, timeZone }),
      });

      if (!extraTime.available) {
        return { reason: extraTime.reason, status: "unavailable" };
      }

      const planned = await planExtraBlocks({
        minutes: extraTime.minutes,
        readSkillIds: async () => skillIds,
        session,
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
