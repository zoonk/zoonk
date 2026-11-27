import { PART_QUESTIONS, getCourseMinutes } from "./_utils/placement-attempt-record";

export const DAY_PLACEMENT_MINUTES = getCourseMinutes(PART_QUESTIONS);

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;

export function getPlacementBudgetSpent(answers: readonly unknown[]): number {
  return Math.min(1, answers.length / PART_QUESTIONS);
}
