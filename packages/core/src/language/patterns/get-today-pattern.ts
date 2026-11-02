import "server-only";
import {
  type LanguageViewGoalResult,
  resolveLanguageViewGoal,
} from "../../view-models/language/_utils/language-view-goal";
import { loadTodayPattern } from "../../view-models/language/_utils/today-pattern";

type TodayPatternResult =
  | Exclude<LanguageViewGoalResult, { status: "ready" }>
  | { pattern: Awaited<ReturnType<typeof loadTodayPattern>>; status: "ready" };

export async function getTodayPattern(
  input: { goalId?: string } = {},
): Promise<TodayPatternResult> {
  "use cache: private";

  const loaded = await resolveLanguageViewGoal(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  return { pattern: await loadTodayPattern(loaded.context), status: "ready" };
}
