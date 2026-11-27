import "server-only";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { after } from "next/server";
import { type AnalyticsEvent } from "./events";
import { type TestEventContext } from "./test-event-catalog";
import { trackLearnerEvents } from "./track-learner-event";

type TestGoal = Pick<Goal, "id" | "planRevealedAt" | "userId">;

export function testEventContext(
  goal: TestGoal,
  {
    attemptId = null,
    part = 1,
    parts = 1,
    questions,
    test,
  }: {
    attemptId?: string | null;
    part?: number;
    parts?: number | null;
    questions: number | null;
    test: TestEventContext["test"];
  },
): TestEventContext {
  return {
    attempt_id: attemptId,
    goal_id: goal.id,
    part,
    parts,
    questions,
    surface: goal.planRevealedAt ? "plan" : "onboarding",
    test,
  };
}

export function trackTestEvents(goal: TestGoal, events: readonly AnalyticsEvent[]): void {
  if (events.length > 0) {
    after(() => trackLearnerEvents({ events, goalId: goal.id, userId: goal.userId }));
  }
}

export function gradedTestAnswer({
  correct,
  unknown = false,
}: {
  correct: boolean | null;
  unknown?: boolean;
}): "correct" | "dont_know" | "incorrect" {
  if (unknown || correct === null) {
    return "dont_know";
  }

  return correct ? "correct" : "incorrect";
}

export function testSkipRow(
  goal: Pick<Goal, "details" | "planRevealedAt">,
  attemptId?: string | null,
): "first_lesson" | "not_now" {
  const requested = isJsonObject(goal.details) && goal.details.placementRequested === true;
  return goal.planRevealedAt || attemptId || requested ? "not_now" : "first_lesson";
}
