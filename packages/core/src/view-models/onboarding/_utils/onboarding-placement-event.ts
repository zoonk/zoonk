import "server-only";
import { type Goal } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsEvent } from "../../../analytics/events";
import { type TestEventContext } from "../../../analytics/test-event-catalog";
import { testEventContext, testSkipRow } from "../../../analytics/test-events";
import { readLevelTestProgress } from "../../../language/level-test/_utils/level-test-state";
import { LANGUAGE_LEVEL_TEST_OFFER } from "../../../language/level-test/level-test-contract";
import { readLevelTestAttempts } from "../../../language/level-test/read-level-test-summary";
import { readPlacementAttempt } from "../../../learner/placement/_utils/placement-attempt-record";
import { readFocusTestRecord } from "../../../learner/placement/focus-test-state";
import { type OnboardingAnswerInput } from "../onboarding-contract";
import { getAnsweredQuestions, isPlacementAhead } from "../onboarding-steps";
import { readOnboardingPlacementOffer } from "./onboarding-placement";

function canPassPlacement(goal: Goal): boolean {
  const details = isJsonObject(goal.details) ? goal.details : {};

  return (
    !goal.planRevealedAt &&
    !goal.replacesGoalId &&
    details.placementPassed !== true &&
    isPlacementAhead(details)
  );
}

function readLanguageSkip(goal: Goal): TestEventContext | null {
  const { attempt } = readLevelTestAttempts(goal);
  const progress = attempt ?? readLevelTestProgress(goal);

  return progress.result || progress.placement || progress.answers.length > 0
    ? null
    : testEventContext(goal, {
        attemptId: progress.attemptId,
        questions: LANGUAGE_LEVEL_TEST_OFFER.total,
        test: "language",
      });
}

function readSkip(goal: Goal): TestEventContext | null {
  if (goal.kind === "language") {
    return readLanguageSkip(goal);
  }

  if (goal.kind === "exam") {
    const record = readFocusTestRecord(goal);

    if ((record?.startedAt && !record.sitting) || record?.sitting?.answered) {
      return null;
    }

    return testEventContext(goal, {
      attemptId: record?.sitting?.id,
      questions: record?.sitting?.questions ?? null,
      test: "focus",
    });
  }

  if (goal.kind !== "learn") {
    return null;
  }

  const { attempt, result } = readPlacementAttempt(goal);

  return attempt || result
    ? null
    : testEventContext(goal, { parts: null, questions: null, test: "course" });
}

export async function readOnboardingPlacementEvent({
  goal,
  input,
}: {
  goal: Goal;
  input: OnboardingAnswerInput;
}): Promise<AnalyticsEvent | null> {
  if (
    (input.question !== "schedule" && input.question !== "placement") ||
    !canPassPlacement(goal)
  ) {
    return null;
  }

  if (input.question === "placement") {
    const skipped = input.attemptId ? null : readSkip(goal);

    return skipped
      ? {
          name: "Test Skipped",
          properties: { ...skipped, row: testSkipRow(goal, skipped.attempt_id) },
        }
      : null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  if (details.placementRequested === true || getAnsweredQuestions(details).includes("schedule")) {
    return null;
  }

  const { data: offer } = await safeAsync(() => readOnboardingPlacementOffer(goal, "offer"));

  return offer && "cold" in offer
    ? { name: "Test Offer Deferred", properties: testEventContext(goal, offer.cold) }
    : null;
}
