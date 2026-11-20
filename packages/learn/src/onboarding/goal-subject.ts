import { type GoalView } from "@zoonk/core/goals/contract";

/**
 * The goal's subject as a chip over its questions. `details.subject` is written to sit mid-sentence
 * ("inglês"), so a chip, which starts a line, capitalizes it in the learner's language.
 */
export function getGoalSubject(
  goal: Pick<GoalView, "details" | "displayName">,
  locale: string,
): string {
  const subject = goal.details.subject;

  if (typeof subject !== "string" || !subject.trim()) {
    return goal.displayName;
  }

  return subject.charAt(0).toLocaleUpperCase(locale) + subject.slice(1);
}
