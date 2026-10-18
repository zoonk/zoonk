import "server-only";
import { loadTargetCutoff } from "../../../exams/cutoffs/load-target-cutoff";
import { type GoalDraft } from "../../../goals/goal-contract";
import {
  type GoalUnderstandingView,
  type OnboardingDraftEdit,
  type UnderstoodGoalView,
} from "../onboarding-contract";

type GoalsUnderstanding = Extract<GoalUnderstandingView, { status: "goals" }>;
type GoalEdit = Exclude<OnboardingDraftEdit, { field: "studyTime" }>;
type Details = NonNullable<GoalDraft["details"]>;

function withoutKey<Value extends object, Key extends keyof Value>(
  value: Value,
  key: Key,
): Omit<Value, Key> {
  const { [key]: _removed, ...rest } = value;
  return rest;
}

function setDetail({
  details,
  key,
  value,
}: {
  details: Details;
  key: string;
  value: string | null;
}) {
  return value === null ? withoutKey(details, key) : { ...details, [key]: value };
}

/** The learner's own deadline replaces the exam's dates on the card; null brings them back. */
function reviseTargetDate({
  goal,
  today,
  value,
}: {
  goal: UnderstoodGoalView;
  today: string;
  value: string | null;
}): UnderstoodGoalView | null {
  if (value !== null && value < today) {
    return null;
  }

  const draft = withoutKey(goal.draft, "targetDate");
  return { ...goal, draft: value === null ? draft : { ...draft, targetDate: value } };
}

function reviseGoal({
  edit,
  goal,
  today,
}: {
  edit: GoalEdit;
  goal: UnderstoodGoalView;
  today: string;
}): UnderstoodGoalView | null {
  switch (edit.field) {
    case "title":
      return { ...goal, draft: { ...goal.draft, title: edit.value } };
    case "targetDate":
      return reviseTargetDate({ goal, today, value: edit.value });
    case "institution":
    case "reason":
    case "role":
    case "targetCourse":
    case "targetPosition":
    case "targetScore": {
      const details = setDetail({
        details: goal.draft.details ?? {},
        key: edit.field,
        value: edit.value,
      });

      return { ...goal, draft: { ...goal.draft, details } };
    }
    default:
      return null;
  }
}

/** A time of their own replaces when the words said they study, on every goal of the card. */
function reviseStudyTime({
  understanding,
  value,
}: {
  understanding: GoalsUnderstanding;
  value: string;
}): GoalsUnderstanding {
  return {
    ...understanding,
    goals: understanding.goals.map((goal) => ({
      ...goal,
      draft: { ...goal.draft, details: withoutKey(goal.draft.details ?? {}, "studyTimeNote") },
    })),
    schedule: { ...understanding.schedule, studyTime: value, studyTimeNote: null },
  };
}

/**
 * The card with one fix applied and every field that depends on it recomputed. Null when the fix
 * doesn't apply: no such goal, or a day already past.
 */
export async function reviseUnderstanding({
  edit,
  today,
  understanding,
}: {
  edit: OnboardingDraftEdit;
  /** The learner's own today, so past days are refused. */
  today: string;
  understanding: GoalsUnderstanding;
}): Promise<GoalsUnderstanding | null> {
  if (edit.field === "studyTime") {
    return reviseStudyTime({ understanding, value: edit.value });
  }

  const goal = understanding.goals[edit.goal];
  const revised = goal ? reviseGoal({ edit, goal, today }) : null;

  if (!revised) {
    return null;
  }

  // Another course, institution or position has its own cut-off, when one is known.
  const cutoff = await loadTargetCutoff({
    details: revised.draft.details,
    examBlueprintId: revised.draft.examBlueprintId,
  });

  return { ...understanding, goals: understanding.goals.with(edit.goal, { ...revised, cutoff }) };
}
