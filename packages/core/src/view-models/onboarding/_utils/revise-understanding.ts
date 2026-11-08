import "server-only";
import { loadTargetCutoff } from "../../../exams/cutoffs/load-target-cutoff";
import { type GoalDraft } from "../../../goals/goal-contract";
import { isLanguageAim } from "../../../language/aims/language-aims";
import {
  type GoalUnderstandingView,
  type OnboardingDraftEdit,
  type UnderstoodGoalView,
} from "../onboarding-contract";
import { getUnderstoodAim } from "./understanding-view";

type GoalsUnderstanding = Extract<GoalUnderstandingView, { status: "goals" }>;
type GoalEdit = Exclude<OnboardingDraftEdit, { field: "studyTime" }>;
type Details = NonNullable<GoalDraft["details"]>;
type TextEdit = Extract<GoalEdit, { value: string | null; field: string }>;

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

/** null restores exam dates; a learner deadline overrides them. */
function reviseTargetDate({
  goal,
  value,
}: {
  goal: UnderstoodGoalView;
  value: string | null;
}): UnderstoodGoalView {
  const draft = withoutKey(goal.draft, "targetDate");
  return { ...goal, draft: value === null ? draft : { ...draft, targetDate: value } };
}

function reviseGoal({
  edit,
  goal,
}: {
  edit: GoalEdit;
  goal: UnderstoodGoalView;
}): UnderstoodGoalView | null {
  switch (edit.field) {
    case "title":
      return { ...goal, draft: { ...goal.draft, title: edit.value } };
    case "targetDate":
      return reviseTargetDate({ goal, value: edit.value });
    case "targetScore":
      return goal.draft.kind === "language" && !isLanguageAim(edit.value)
        ? null
        : setTextDetail({ edit, goal });
    case "institution":
    case "reason":
    case "role":
    case "targetCourse":
    case "targetPosition":
      return setTextDetail({ edit, goal });
    default:
      return null;
  }
}

function setTextDetail({
  edit,
  goal,
}: {
  edit: Exclude<TextEdit, { field: "targetDate" }>;
  goal: UnderstoodGoalView;
}): UnderstoodGoalView {
  const details = setDetail({
    details: goal.draft.details ?? {},
    key: edit.field,
    value: edit.value,
  });

  return { ...goal, draft: { ...goal.draft, details } };
}

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

/** Recomputes dependent fields; returns null for an inapplicable fix. */
export async function reviseUnderstanding({
  edit,
  understanding,
}: {
  edit: OnboardingDraftEdit;
  understanding: GoalsUnderstanding;
}): Promise<GoalsUnderstanding | null> {
  if (edit.field === "studyTime") {
    return reviseStudyTime({ understanding, value: edit.value });
  }

  const goal = understanding.goals[edit.goal];
  const revised = goal ? reviseGoal({ edit, goal }) : null;

  if (!revised) {
    return null;
  }

  const cutoff = await loadTargetCutoff({
    details: revised.draft.details,
    examBlueprintId: revised.draft.examBlueprintId,
  });

  return {
    ...understanding,
    goals: understanding.goals.with(edit.goal, {
      ...revised,
      cutoff,
      languageAim: getUnderstoodAim(revised.draft),
    }),
  };
}
