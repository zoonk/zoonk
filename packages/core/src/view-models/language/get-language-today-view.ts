import "server-only";
import { readGoalDetails } from "../../language/_utils/language-goal";
import { loadSpeakingPaperEntry } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import {
  getTargetLevel,
  loadLanguageSkillLevels,
} from "../../language/levels/language-skill-levels";
import { getOverallLevel } from "../../language/levels/skill-level-rules";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { type DayView } from "../../sessions/day-view";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { keepsTodayPattern, loadTodayPattern } from "./_utils/today-pattern";
import { type LanguageTodayView } from "./language-view-contract";

export type LanguageTodayViewResult =
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; today: LanguageTodayView };

/**
 * What Today adds for a language goal: the level across skills with the target ("A2+ → B1+"),
 * which stands in for preparation, a pattern noticed in recent mistakes that wasn't practiced yet,
 * the words to say again today, and the exam-style speaking tasks to practice any time.
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

  const [levels, pattern, pronunciation, speaking] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    loadTodayPattern({ goal, userId }),
    loadDuePronunciation({ language: goal.targetLanguage, userId }),
    loadSpeakingPaperEntry({ goal }),
  ]);

  const label = getOverallLevel(levels.map((level) => level.score));

  return {
    status: "ready",
    today: {
      level: label ? { label, target: getTargetLevel(details)?.label ?? null } : null,
      pattern,
      pronunciation,
      speaking,
    },
  };
}

/**
 * Today's language section beside the day Today read: its pattern steps aside when one of the
 * day's missions is that drill (`keepsTodayPattern`). The read above already does this for a saved
 * day. An unopened day's missions exist only in Today's own read, so the screen that shows both
 * applies it to that read instead of building the day a second time.
 */
export function hidePatternCoveredByDay({
  day,
  language,
}: {
  day: Pick<DayView, "fullMeal" | "missions">;
  language: LanguageTodayView;
}): LanguageTodayView {
  const { pattern } = language;

  if (!pattern) {
    return language;
  }

  const covered = day.missions.some(
    (mission) => mission.opens?.kind === "pattern" && mission.opens.patternId === pattern.id,
  );

  return keepsTodayPattern({ covered, earned: day.fullMeal.earned, missions: day.missions })
    ? language
    : { ...language, pattern: null };
}
