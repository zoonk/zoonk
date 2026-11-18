import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import {
  type LearnerSummaryGoal,
  type LearnerSummaryWaitingGoal,
} from "@zoonk/core/learner/summary/contract";
import { hasNothingToSwitch } from "@zoonk/learn/goal-switcher";

export function toSwitcherGoals(goals: readonly LearnerSummaryGoal[]) {
  return goals.flatMap(
    ({
      dailyMinutes,
      displayName,
      id,
      kind,
      languageFlag,
      status,
      targetDate,
      targetDateEstimated,
      targetLanguage,
      targetRegion,
    }) =>
      status === "archived" || (kind === "explain" && status === "completed")
        ? []
        : [
            {
              dailyMinutes,
              displayName,
              id,
              kind,
              languageFlag,
              status,
              targetDate,
              targetDateEstimated,
              targetLanguage,
              targetRegion,
            },
          ],
  );
}

export function toSwitcherWaitingGoals(goals: readonly LearnerSummaryWaitingGoal[]) {
  return goals.flatMap(({ id, input, languageFlag, locked, displayName }) => {
    const [goal] = input.goals;

    return goal
      ? [
          {
            displayName,
            id,
            languageFlag,
            locked,
            targetLanguage: goal.targetLanguage ?? null,
            targetRegion: goal.targetRegion ?? null,
          },
        ]
      : [];
  });
}

/** Whether the frame's goal menu is the plain "Start a goal" link. */
export function useMenuStartsGoal(): boolean {
  const learner = useFrameLearner();

  return (
    learner.status === "ready" &&
    hasNothingToSwitch({
      goals: toSwitcherGoals(learner.summary.goals),
      waitingGoals: toSwitcherWaitingGoals(learner.summary.waitingGoals),
    })
  );
}
