import "server-only";
import { type LanguageUnit, loadLanguageUnits } from "../../../language/units/language-units";
import {
  type LanguageViewGoal,
  type LanguageViewGoalResult,
  resolveLanguageViewGoal,
} from "./language-view-goal";

type LanguageGoalContext = LanguageViewGoal & { units: LanguageUnit[] };

export type LanguageGoalContextResult =
  | { context: LanguageGoalContext; status: "ready" }
  | Exclude<LanguageViewGoalResult, { status: "ready" }>;

/** The owned language goal and its course's units, for screens that draw those units. */
export async function loadLanguageGoalContext(goalId?: string): Promise<LanguageGoalContextResult> {
  const loaded = await resolveLanguageViewGoal(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const units = await loadLanguageUnits(loaded.context.goal);
  return { context: { ...loaded.context, units }, status: "ready" };
}
