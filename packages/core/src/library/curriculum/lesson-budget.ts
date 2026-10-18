import { daysBetween } from "../../plans/planner/plan-calendar";
import { getExamWindows, getLearningShare } from "../../plans/planner/plan-phases";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { isShortExam } from "../../plans/planner/short-exam-plan";

/**
 * The most time a day a test days away is studied for. The graph is written before the learner
 * picks their daily time, so it's sized by the material up to what the days hold at this time;
 * the plan then fits the time they pick, and the time step recommends what the material needs.
 */
const MOST_CLASS_TEST_MINUTES = 120;

/**
 * The most lessons the days before a test days away hold: each day's share for new lessons in the
 * short plan's phases (the last day reviews and rehearses, with nothing new) at the most time a
 * class test takes a day. Null for a test further away, which plans like any exam.
 */
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
