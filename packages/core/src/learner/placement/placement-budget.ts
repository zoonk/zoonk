import { MS_PER_MINUTE, MS_PER_SECOND } from "@zoonk/utils/date";

const COURSE_ANSWER_MS = 32 * MS_PER_SECOND;

export function getCourseMinutes(questions: number): number {
  return Math.round((questions * COURSE_ANSWER_MS) / MS_PER_MINUTE);
}

export const DAY_PLACEMENT_MINUTES = 6;

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;
