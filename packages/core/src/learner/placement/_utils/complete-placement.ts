import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type z } from "zod";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { replanAfterPlacement } from "../../../plans/replan-after-placement";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type FocusTestView } from "../focus-test-contract";
import { readFocusTestRecord } from "../focus-test-state";
import { type SittingOffer } from "../focus-test-view";
import { type placementFinishSchema } from "../placement-contract";
import { type AreaStart, type PhaseStart } from "../placement-steps";
import { applyPlacement } from "./apply-placement";
import { type PlacementState } from "./load-placement-state";
import { type PlacementAttemptView, type PlacementResult } from "./placement-attempt-record";
import { settleFocusTest } from "./settle-focus-test";
import { closeTestSitting } from "./test-sitting";

export type PlacementCompletion = {
  areas: AreaStart[];
  attempt?: PlacementAttemptView | null;
  changeId: string | null;
  /** False when the plan has no skills. */
  complete: boolean;
  /** An exam goal's test after this finish, with its result; null for other goals. */
  finish?: z.infer<typeof placementFinishSchema>;
  focusTest: FocusTestView | null;
  heldUntilTomorrow?: true;
  knownSkillIds: string[];
  lessonsSkipped: number;
  phases: PhaseStart[];
  result?: PlacementResult | null;
  testedOutPlanItemIds: string[];
};

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

  const closed = tested ? await closeTestSitting({ goal, sittingId, timeZone }) : null;
  const applied = await applyPlacement({ goalId, now, plan, timeZone, userId });

  if (closed) {
    trackTestEvents(goal, [
      {
        name: "Test Finished",
        properties: {
          ...testEventContext(goal, {
            attemptId: closed.id,
            questions: closed.questions,
            test: "focus",
          }),
          answered: closed.answered,
          duration_ms: closed.durationMs,
          end: closed.end,
          lessons_skipped: applied.lessonsSkipped,
          levels_skipped: 0,
          parts_left: 0,
          unknowns: closed.dontKnow,
        },
      },
    ]);
  }

  if (!applied.changeId && (!goal.planRevealedAt || tested)) {
    await replanAfterPlacement({ goalId, now, timeZone });
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
      changeId: applied.changeId,
      complete: state.complete,
      ...(closed && {
        finish: {
          answered: closed.answered,
          end: closed.end,
          lessonsSkipped: applied.lessonsSkipped,
          unknowns: closed.dontKnow,
        },
      }),
      focusTest: state.focusTest,
      knownSkillIds: state.knownSkillIds,
      lessonsSkipped: applied.lessonsSkipped,
      phases: state.phases,
      testedOutPlanItemIds: applied.testedOutPlanItemIds,
    },
    offer,
    state,
  };
}
