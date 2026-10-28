import "server-only";
import { readGoalDetails } from "../../language/_utils/language-goal";
import { loadSpeakingPaperEntry } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import {
  getTargetLevel,
  loadLanguageSkillLevels,
} from "../../language/levels/language-skill-levels";
import { getOverallLevel } from "../../language/levels/skill-level-rules";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
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

  const [levels, pronunciation, speaking] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    loadDuePronunciation({ language: goal.targetLanguage, userId }),
    loadSpeakingPaperEntry({ goal }),
  ]);

  const label = getOverallLevel(levels.map((level) => level.score));

  return {
    status: "ready",
    today: {
      level: label ? { label, target: getTargetLevel(details)?.label ?? null } : null,
      pronunciation,
      speaking,
    },
  };
}
