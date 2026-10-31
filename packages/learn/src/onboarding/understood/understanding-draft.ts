import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import {
  type UnderstoodGoalView,
  type UnderstoodSchedule,
} from "@zoonk/core/view-models/onboarding/contract";

export type UnderstandingDraft = {
  goals: UnderstoodGoalView[];
  minutesSaid: boolean;
  schedule: UnderstoodSchedule;
};

export function toUnderstandingDraft({
  goals,
  schedule,
}: {
  goals: UnderstoodGoalView[];
  schedule: UnderstoodSchedule;
}): UnderstandingDraft {
  const answered = goals[0]?.draft.details?.answered;
  const minutesSaid = Array.isArray(answered) && answered.includes("schedule");

  return { goals, minutesSaid, schedule };
}

type Draft = UnderstoodGoalView["draft"];

function withMaterialIntent({
  draft,
  intent,
}: {
  draft: Draft;
  intent: "exam" | "questions" | "understand" | null;
}): Draft {
  if (intent !== "exam" && intent !== "understand") {
    return draft;
  }

  const details: NonNullable<Draft["details"]> = { ...draft.details, materialIntent: intent };
  const needsPurpose = intent === "understand" && !details.purpose;

  return { ...draft, details: needsPurpose ? { ...details, purpose: "other" } : details };
}

export function toGoalCreateInput({
  draft,
  materialIntent = null,
  sourceIds = [],
  timeZone,
}: {
  draft: UnderstandingDraft;
  materialIntent?: "exam" | "questions" | "understand" | null;
  sourceIds?: string[];
  timeZone: string;
}): GoalCreateInput {
  return {
    dailyMinutes: draft.schedule.dailyMinutes,
    goals: draft.goals.map((goal, index) =>
      index === 0 ? withMaterialIntent({ draft: goal.draft, intent: materialIntent }) : goal.draft,
    ),
    sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    studyDays: draft.schedule.studyDays ?? undefined,
    studyTime: draft.schedule.studyTime ?? undefined,
    timeZone,
  };
}
