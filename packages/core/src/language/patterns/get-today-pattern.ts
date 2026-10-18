import "server-only";
import {
  type LanguageViewGoalResult,
  resolveLanguageViewGoal,
} from "../../view-models/language/_utils/language-view-goal";
import { loadTodayPattern } from "../../view-models/language/_utils/today-pattern";

type TodayPatternResult =
  | Exclude<LanguageViewGoalResult, { status: "ready" }>
  | { pattern: Awaited<ReturnType<typeof loadTodayPattern>>; status: "ready" };

/**
 * The notebook's pattern prompt, without unrelated reads. It steps aside as Today's card does, but
 * only beside a SAVED day whose missions offer its drill, since it doesn't build an unopened day.
 */
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
