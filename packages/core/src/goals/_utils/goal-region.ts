import { type Goal } from "@zoonk/db";
import {
  type RegionChoice,
  getRegionChoices,
  isLanguageRegion,
} from "@zoonk/utils/language-regions";

type GoalLanguage = Pick<Goal, "kind" | "language" | "targetLanguage">;

export function isGoalRegion({ goal, region }: { goal: GoalLanguage; region: string }): boolean {
  return (
    goal.kind === "language" &&
    goal.targetLanguage !== null &&
    isLanguageRegion({ language: goal.targetLanguage, region })
  );
}

export function getGoalRegionChoices(goal: GoalLanguage): RegionChoice[] {
  return goal.kind === "language" && goal.targetLanguage
    ? getRegionChoices({ language: goal.targetLanguage, userLanguage: goal.language })
    : [];
}
