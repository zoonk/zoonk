import { type DifficultyBias, parsePlanSettings } from "../../plans/planner/plan-state";

const EXAM_WEEK_DAYS = 7;

/** In the last exam week, stop raising practice above the exam's difficulty. */
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
