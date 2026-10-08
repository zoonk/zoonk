import { type DifficultyBias, parsePlanSettings } from "../../plans/planner/plan-state";

/** The days before an exam that practice at its level, not above it. */
const EXAM_WEEK_DAYS = 7;

/**
 * How hard the day's practice is: what the learner steered toward, and harder once every lesson
 * is learned and the date is more than a week away, so the practice days a plan has left go past
 * the minimum (exam-level questions and above) instead of repeating what's easy for them now.
 */
export function getPracticeDifficulty({
  daysToExam,
  hasLessonsLeft,
  settings,
}: {
  daysToExam: number | null;
  hasLessonsLeft: boolean;
  settings: unknown;
}): DifficultyBias {
  const { difficultyBias } = parsePlanSettings(settings);
  const isPracticeTime = !hasLessonsLeft && daysToExam !== null && daysToExam > EXAM_WEEK_DAYS;

  return isPracticeTime && difficultyBias !== "easier" ? "harder" : difficultyBias;
}
