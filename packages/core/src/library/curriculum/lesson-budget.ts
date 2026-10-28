import { daysBetween } from "../../plans/planner/plan-calendar";
import { getExamWindows, getLearningShare } from "../../plans/planner/plan-phases";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { isShortExam } from "../../plans/planner/short-exam-plan";

const MOST_CLASS_TEST_MINUTES = 120;

export function getLessonBudget({
  targetDate,
  today,
}: {
  targetDate: Date | null;
  today: Date;
}): number | null {
  if (!targetDate || !isShortExam({ planStart: today, targetDate })) {
    return null;
  }

  const minutes = getExamWindows({ planStart: today, targetDate }).reduce(
    (total, window) =>
      total +
      (daysBetween(window.startDate, window.endDate) + 1) *
        getLearningShare({ phaseKind: window.kind, practiceBias: "balanced" }) *
        MOST_CLASS_TEST_MINUTES,
    0,
  );

  return Math.max(1, Math.floor(minutes / DEFAULT_LESSON_MINUTES));
}
