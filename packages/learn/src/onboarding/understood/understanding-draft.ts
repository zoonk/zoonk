import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import {
  type UnderstoodGoalView,
  type UnderstoodSchedule,
} from "@zoonk/core/view-models/onboarding/contract";

/** What the learner is confirming on the card, with their edits. */
export type UnderstandingDraft = {
  goals: UnderstoodGoalView[];
  /** Whether the typed goal said how long they study, so the card shows it. */
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

/**
 * The main goal remembers what the learner wants from their material: an exam on it asks for its
 * date, and lessons that teach it skip the "what for" question.
 */
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

/** The confirmed card as `POST /v1/goals` takes it: the goals share the day's time. */
export function toGoalCreateInput({
  draft,
  materialIntent = null,
  sourceIds = [],
  timeZone,
}: {
  draft: UnderstandingDraft;
  /** What the learner chose to do with the material they attached. */
  materialIntent?: "exam" | "questions" | "understand" | null;
  /** Material attached with the paperclip, for the main goal's research and curriculum. */
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
