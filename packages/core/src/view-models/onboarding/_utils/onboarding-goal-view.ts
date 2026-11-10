import { type GoalKind } from "@zoonk/db/enums";
import { type GoalView } from "../../../goals/goal-contract";
import { getAnsweredQuestions } from "../onboarding-steps";

export function toOnboardingGoalView({ kind, view }: { kind: GoalKind; view: GoalView }): GoalView {
  const answered = getAnsweredQuestions(view.details);

  if (kind === "language" || !answered.includes("reason")) {
    return view;
  }

  return {
    ...view,
    details: { ...view.details, answered: answered.filter((question) => question !== "reason") },
  };
}
