const COURSE_ANSWER_SECONDS = 32;

export function getCourseMinutes(questions: number): number {
  return Math.round((questions * COURSE_ANSWER_SECONDS) / 60);
}

export const DAY_PLACEMENT_MINUTES = 6;

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;
