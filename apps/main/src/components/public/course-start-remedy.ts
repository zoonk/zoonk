import { type CourseStartFailure } from "./use-course-start";

type CourseStartRemedy = "signUp" | "upgrade" | "retry" | null;

export function getCourseStartRemedy(failure: CourseStartFailure): CourseStartRemedy {
  if (failure.status !== "limitReached") {
    return "retry";
  }

  if (failure.reason === "guest" || failure.reason === "signUpRequired") {
    return "signUp";
  }

  return failure.reason === "oneActiveGoal" ? "upgrade" : null;
}

/** Then the page offers that in place of a start that would be refused again. */
export function isStartBlocked(failure: CourseStartFailure | null): boolean {
  const remedy = failure ? getCourseStartRemedy(failure) : null;
  return remedy === "signUp" || remedy === "upgrade";
}
