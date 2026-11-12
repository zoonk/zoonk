import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { trackLearnerEvents } from "../../../analytics/track-learner-event";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { replanAfterPlacement } from "../../../plans/replan-after-placement";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type FocusTestView } from "../focus-test-contract";
import { readFocusTestRecord } from "../focus-test-state";
import { type SittingOffer } from "../focus-test-view";
import { type AreaStart, type PhaseStart } from "../placement-steps";
import { applyPlacement } from "./apply-placement";
import { type PlacementState } from "./load-placement-state";
import { settleFocusTest } from "./settle-focus-test";
import { type ClosedSitting, closeTestSitting } from "./test-sitting";

export type PlacementCompletion = {
  areas: AreaStart[];
  /** False when the plan has no skills. */
  complete: boolean;
  /** An exam goal's test after this finish, with its result; null for other goals. */
  focusTest: FocusTestView | null;
  knownSkillIds: string[];
  phases: PhaseStart[];
  testedOutPlanItemIds: string[];
};

function trackSittingFinished({ closed, goal }: { closed: ClosedSitting | null; goal: Goal }) {
  if (!closed) {
    return;
  }

  after(() =>
    trackLearnerEvents({
      events: [
        {
          name: "Focus Test Sitting Finished",
          properties: {
            answered: closed.answered,
            dont_know: closed.dontKnow,
            duration_ms: closed.durationMs,
            kind: closed.kind,
            questions: closed.questions,
          },
        },
      ],
      goalId: goal.id,
      userId: goal.userId,
    }),
  );
}

/**
 * Applies every answer so far to where the plan starts. An exam goal's open sitting closes first,
 * and its test settles on the plan as it stands after the answers were applied.
 */
export async function completePlacement({
  goal,
  plan,
  sittingId = readFocusTestRecord(goal)?.sitting?.id ?? null,
  timeZone,
}: {
  goal: Goal;
  plan: GoalPlan;
  sittingId?: string | null;
  timeZone: string;
}): Promise<{
  completion: PlacementCompletion;
  /** The sitting an exam goal's start would open after this finish. */
  offer: SittingOffer | null;
  state: PlacementState;
}> {
  const { id: goalId, userId } = goal;
  const now = new Date();
  const tested = goal.kind === "exam";

  if (tested) {
    const skillIds = plan.skills.map((skill) => skill.id);

    trackSittingFinished({
      closed: await closeTestSitting({ goal, sittingId, skillIds, timeZone }),
      goal,
    });
  }

  const applied = await applyPlacement({ goalId, now, plan, timeZone, userId });

  if (!applied.changeId) {
    await replanAfterPlacement({ goalId, now, pastBasicsAreas: applied.pastBasicsAreas, timeZone });
  }

  await owePlanStartLessons({ goalId, userId });

  const { offer, state } = tested
    ? await settleFocusTest({
        goalId,
        timeZone,
        today: getDateInTimeZone({ date: now, timeZone }),
        userId,
      })
    : { offer: null, state: applied.state };

  return {
    completion: {
      areas: state.areas,
      complete: state.complete,
      focusTest: state.focusTest,
      knownSkillIds: state.knownSkillIds,
      phases: state.phases,
      testedOutPlanItemIds: applied.testedOutPlanItemIds,
    },
    offer,
    state,
  };
}
