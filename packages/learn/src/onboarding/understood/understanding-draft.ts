import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import {
  type UnderstoodGoalView,
  type UnderstoodSchedule,
} from "@zoonk/core/view-models/onboarding/contract";

export type UnderstandingDraft = {
  goals: UnderstoodGoalView[];
  lockedGoals: UnderstoodGoalView[];
  minutesSaid: boolean;
  schedule: UnderstoodSchedule;
  timeZone: string;
};

export function toUnderstandingDraft({
  activeGoalsLeft,
  timeZone,
  understanding: { goals, schedule },
}: {
  activeGoalsLeft: number | null;
  timeZone: string;
  understanding: { goals: UnderstoodGoalView[]; schedule: UnderstoodSchedule };
}): UnderstandingDraft {
  const answered = goals[0]?.draft.details?.answered;
  const minutesSaid = Array.isArray(answered) && answered.includes("schedule");
  const allowed = activeGoalsLeft ?? goals.length;

  return {
    goals: goals.slice(0, allowed),
    lockedGoals: goals.slice(allowed),
    minutesSaid,
    schedule,
    timeZone,
  };
}

/** In the draft's zone, which counted the learner's today for the card's dates. */
export function toGoalCreateInput(draft: UnderstandingDraft): GoalCreateInput {
  return {
    dailyMinutes: draft.schedule.dailyMinutes,
    goals: draft.goals.map((goal) => goal.draft),
    studyDays: draft.schedule.studyDays ?? undefined,
    studyTime: draft.schedule.studyTime ?? undefined,
    timeZone: draft.timeZone,
  };
}
