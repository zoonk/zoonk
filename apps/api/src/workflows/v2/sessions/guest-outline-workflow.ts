import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  listPlanOutlines,
  startAll,
  startPlanOutline,
  whileLessonsAsked,
} from "../goals/goal-outlines";
import { readGoalLookaheadStep } from "../goals/steps/goal-lookahead-steps";

export type GuestOutlineInput = {
  analytics: ContentAnalytics;
  goalId: string;
  lessonsAskedAt?: number | null;
};

export async function guestOutlineWorkflow({
  analytics,
  goalId,
  lessonsAskedAt,
}: GuestOutlineInput) {
  "use workflow";

  await whileLessonsAsked({
    goalId,
    lessonsAskedAt,
    run: async (started) => {
      const { outlineDays } = await readGoalLookaheadStep(goalId);
      const outlines = await listPlanOutlines({ days: outlineDays, goalId });

      await startAll(
        outlines.map((outline) =>
          startPlanOutline({ analytics, forGuest: true, outline, started }),
        ),
      );
    },
  });
}
