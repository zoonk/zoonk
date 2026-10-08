import "server-only";
import { readGoalDetails } from "../../language/_utils/language-goal";
import {
  getTargetLevel,
  loadLanguageSkillLevels,
} from "../../language/levels/language-skill-levels";
import { getOverallLevel } from "../../language/levels/skill-level-rules";
import { findFreshMistakePattern } from "../../language/patterns/find-fresh-pattern";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { type LanguageTodayView } from "./language-view-contract";

export type LanguageTodayViewResult =
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; today: LanguageTodayView };

/**
 * What Today adds for a language goal: the level across skills with the target ("A2+ → B1+"),
 * which stands in for preparation, a pattern noticed in recent mistakes that wasn't practiced yet,
 * and the words to say again today.
 */
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

  const [levels, pattern, pronunciation] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    findFreshMistakePattern({ language: goal.targetLanguage, userId }),
    loadDuePronunciation({ language: goal.targetLanguage, userId }),
  ]);

  const label = getOverallLevel(levels.map((level) => level.score));

  return {
    status: "ready",
    today: {
      level: label ? { label, target: getTargetLevel(details)?.label ?? null } : null,
      pattern,
      pronunciation,
    },
  };
}
