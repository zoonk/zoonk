import "server-only";
import { type EnergyLevelData } from "./energy";
import { type BeltLevelDetails, getBeltLevel } from "./get-belt-level";
import { getEnergyLevel } from "./get-energy-level";
import {
  type LearningActivityTotals,
  getLearningActivityTotals,
} from "./get-learning-activity-totals";
import { getScore } from "./get-score";
import { type ScorePatternsData, getScorePatterns } from "./get-score-patterns";
import { type ScorePerformance } from "./score-performance";

type StrongestScorePatterns = Pick<ScorePatternsData, "strongestTime" | "strongestWeekday">;

export type CurrentUserProgress = {
  activity: LearningActivityTotals;
  energy: EnergyLevelData | null;
  level: BeltLevelDetails | null;
  score: ScorePerformance | null;
  scorePatterns: StrongestScorePatterns | null;
};

/**
 * Returns the compact learner progress resource used by Home without loading
 * the 53-week calendars or complete Score pattern breakdowns needed only by
 * detail screens. A missing Activity result identifies an unauthenticated
 * request because authenticated learners always have zero-valued totals.
 */
export async function getCurrentUserProgress(): Promise<CurrentUserProgress | null> {
  "use cache: private";

  const [activity, energy, level, score, scorePatterns] = await Promise.all([
    getLearningActivityTotals(),
    getEnergyLevel(),
    getBeltLevel(),
    getScore(),
    getScorePatterns(),
  ]);

  if (!activity) {
    return null;
  }

  return {
    activity,
    energy,
    level,
    score,
    scorePatterns: scorePatterns
      ? {
          strongestTime: scorePatterns.strongestTime,
          strongestWeekday: scorePatterns.strongestWeekday,
        }
      : null,
  };
}
