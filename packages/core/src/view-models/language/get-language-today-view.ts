import "server-only";
import { readGoalDetails } from "../../language/_utils/language-goal";
import { loadSpeakingPaperEntry } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import { getTargetLevel } from "../../language/levels/language-skill-levels";
import { readDuePronunciation } from "../../learner/facts/due-pronunciation";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { readPlanLevel } from "./_utils/plan-level";
import { type LanguageTodayView } from "./language-view-contract";

export type LanguageTodayViewResult =
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; today: LanguageTodayView };

/** Requires an owned language goal; Today composes pattern cards separately against its own missions. */
export async function getLanguageTodayView(
  input: { goalId?: string } = {},
): Promise<LanguageTodayViewResult> {
  "use cache: private";

  const loaded = await loadLanguageGoalContext(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal, userId } = loaded.context;
  const details = readGoalDetails(goal);

  const [level, pronunciation, speaking] = await Promise.all([
    readPlanLevel({ goal, target: getTargetLevel(details) }),
    readDuePronunciation(userId, goal.targetLanguage),
    loadSpeakingPaperEntry({ goal }),
  ]);

  return { status: "ready", today: { level, pronunciation, speaking } };
}
