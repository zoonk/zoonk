import { type Goal } from "@zoonk/db";
import { getVarietyFlagCode } from "@zoonk/utils/language-regions";

/** Main's `GoalMark`: only a language goal shows a flag, its country's when chosen; an exam keeps its letter. */
export function getGoalLanguageFlag(
  goal: Pick<Goal, "kind" | "targetLanguage" | "targetRegion">,
): string | null {
  return goal.kind === "language" && goal.targetLanguage
    ? getVarietyFlagCode({ language: goal.targetLanguage, region: goal.targetRegion })
    : null;
}
