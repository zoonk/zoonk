import { type GoalKind } from "@zoonk/db";
import { getVarietyFlagCode } from "@zoonk/utils/language-regions";

type GoalLanguage = {
  kind: GoalKind;
  targetLanguage?: string | null;
  targetRegion?: string | null;
};

/** Main's `GoalMark`: only a language goal shows a flag, its country's when chosen; an exam keeps its letter. */
export function getGoalLanguageFlag(goal: GoalLanguage): string | null {
  return goal.kind === "language" && goal.targetLanguage
    ? getVarietyFlagCode({ language: goal.targetLanguage, region: goal.targetRegion })
    : null;
}
