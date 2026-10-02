import "server-only";
import { type Goal } from "@zoonk/db";
import { type LanguageUnit, loadLanguageUnits } from "../../../language/units/language-units";
import { resolveViewGoal } from "../../_utils/resolve-view-goal";

export type LanguageGoalContext = {
  goal: Goal & { targetLanguage: string };
  units: LanguageUnit[];
  userId: string;
};

export type LanguageGoalContextResult =
  | { context: LanguageGoalContext; status: "ready" }
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" };

/**
 * The language goal a screen shows (the one asked for, or the active goal) with its course's
 * units. Any other kind of goal is `notLanguage`, so the app shows its usual screen.
 */
export async function loadLanguageGoalContext(goalId?: string): Promise<LanguageGoalContextResult> {
  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" };
  }

  const units = await loadLanguageUnits(goal);

  return {
    context: { goal: { ...goal, targetLanguage }, units, userId: goal.userId },
    status: "ready",
  };
}
