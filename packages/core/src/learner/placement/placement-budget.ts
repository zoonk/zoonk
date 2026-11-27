import { LOW_GUESS_ANSWERS_TO_SKIP } from "../_utils/placement-guess-rate";

const COURSE_ANSWER_SECONDS = 32;

export const TOPICS_PER_PART = 3;
export const QUESTIONS_PER_TOPIC = 1 + LOW_GUESS_ANSWERS_TO_SKIP;
export const PART_QUESTIONS = TOPICS_PER_PART * QUESTIONS_PER_TOPIC;

export function getCourseMinutes(questions: number): number {
  return Math.round((questions * COURSE_ANSWER_SECONDS) / 60);
}

export const DAY_PLACEMENT_MINUTES = getCourseMinutes(PART_QUESTIONS);

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;

export function getPlacementBudgetSpent(answers: readonly unknown[]): number {
  return Math.min(1, answers.length / PART_QUESTIONS);
}
