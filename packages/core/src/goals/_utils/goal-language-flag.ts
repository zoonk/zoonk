import { type Goal } from "@zoonk/db";
import { type LanguageFlagCode, getLanguageFlagCode } from "@zoonk/utils/language-flags";

/** Main's `GoalMark`: only a language goal shows its language's flag; an exam keeps its letter. */
export function getGoalLanguageFlag(
  goal: Pick<Goal, "kind" | "targetLanguage">,
): LanguageFlagCode | null {
  return goal.kind === "language" && goal.targetLanguage
    ? getLanguageFlagCode(goal.targetLanguage)
    : null;
}
