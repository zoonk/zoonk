import { type GoalLimitReason, needsAccountFor } from "@zoonk/learn/onboarding/actions";
import { type CourseStartFailure } from "./use-course-start";

type CourseStartRemedy = "signUp" | "subscribe" | "upgrade" | "retry" | null;

const SUBSCRIBE_REASONS = new Set<GoalLimitReason>(["monthlyExplanations", "monthlyGoals"]);

export function getCourseStartRemedy(failure: CourseStartFailure): CourseStartRemedy {
  if (failure.status !== "limitReached") {
    return "retry";
  }

  if (needsAccountFor(failure.reason)) {
    return "signUp";
  }

  if (failure.reason === "activeGoals") {
    return "upgrade";
  }

  return SUBSCRIBE_REASONS.has(failure.reason) ? "subscribe" : null;
}

/** Then the page offers that in place of a start that would be refused again. */
export function isStartBlocked(failure: CourseStartFailure | null): boolean {
  const remedy = failure ? getCourseStartRemedy(failure) : null;
  return remedy === "signUp" || remedy === "subscribe" || remedy === "upgrade";
}
