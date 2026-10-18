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

/**
 * What Today adds for a language goal: the level across skills with the target ("A2+ → B1+"),
 * which stands in for preparation, the words to say again today, and the exam-style speaking tasks
 * to practice any time. The pattern noticed in recent mistakes is Today's own
 * (`TodayView.pattern`): it steps aside for the day's missions, which only Today reads.
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
