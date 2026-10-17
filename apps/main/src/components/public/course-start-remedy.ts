import { type CourseStartFailure } from "./use-course-start";

type CourseStartRemedy = "signUp" | "upgrade" | "retry" | null;

/**
 * What to do next: an account, Plus (with the free way under it, pausing the goal they're on), or
 * another try. A limit that only needs time (the day's goals, too many at once) has none.
 */
export function getCourseStartRemedy(failure: CourseStartFailure): CourseStartRemedy {
  if (failure.status !== "limitReached") {
    return "retry";
  }

  if (failure.reason === "guest" || failure.reason === "signUpRequired") {
    return "signUp";
  }

  return failure.reason === "oneActiveGoal" ? "upgrade" : null;
}

/**
 * Whether the start can only go on with an account, Plus or a paused goal: then that's what the
 * page offers, in place of a start that would be refused again.
 */
export function isStartBlocked(failure: CourseStartFailure | null): boolean {
  const remedy = failure ? getCourseStartRemedy(failure) : null;
  return remedy === "signUp" || remedy === "upgrade";
}
