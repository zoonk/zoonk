import { randomUUID } from "node:crypto";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type GoalDraft } from "../../goals/goal-contract";
import { isInputRangeError } from "../../plans/target-date-range";
import { getLearnerToday } from "./_utils/understanding-view";
import { createOnboardingGoals } from "./create-onboarding-goals";
import { getOnboarding } from "./get-onboarding";

/** Kiritimati's today is a day ahead of most zones, as a card read last night or elsewhere is. */
const timeZone = "Pacific/Kiritimati";

function learnGoal(details: GoalDraft["details"]): GoalDraft {
  return {
    details: { purpose: "overview", ...details },
    kind: "learn",
    language: "en",
    prompt: "Learn chess",
    targetDate: getLearnerToday(timeZone),
    title: "Learn chess",
  };
}

describe(createOnboardingGoals, () => {
  it("starts a card's goal whose date is no longer ahead without it, and setup asks the date", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const created = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({ onboardingId: randomUUID() })],
      timeZone,
    });

    expect(created).toMatchObject({ goals: [{ targetDate: null }], status: "created" });

    const goalId = created.status === "created" ? (created.goals[0]?.id ?? "") : "";
    const setup = await getOnboarding({ goalId });

    expect(setup.status === "ready" && setup.onboarding.steps).toContain("targetDate");
  });

  it("refuses a date no card gave", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const refusal = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({})],
      timeZone,
    }).catch((error: unknown) => (isInputRangeError(error) ? error.issues : error));

    expect(refusal).toMatchObject([{ params: { bound: "earliest" } }]);
  });
});
