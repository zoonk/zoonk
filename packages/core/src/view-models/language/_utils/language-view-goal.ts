import "server-only";
import { type Goal } from "@zoonk/db";
import { resolveViewGoal } from "../../_utils/resolve-view-goal";

export type LanguageViewGoal = { goal: Goal & { targetLanguage: string }; userId: string };

export type LanguageViewGoalResult =
  | { context: LanguageViewGoal; status: "ready" }
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" };

/** Resolves the owned language goal without loading its course or another screen's fields. */
export async function resolveLanguageViewGoal(goalId?: string): Promise<LanguageViewGoalResult> {
  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" };
  }

  return { context: { goal: { ...goal, targetLanguage }, userId: goal.userId }, status: "ready" };
}
