import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalGenerationId } from "./get-goal-generation-id";

describe(getGoalGenerationId, () => {
  it("reads the learner's goal's run in one statement, not the onboarding view", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ generationRunId: "wrun_owned", userId: user.id });
    mockSession(user.id);

    const counts = await countDatabaseStatements(() => getGoalGenerationId({ goalId: goal.id }));

    assertReadBudget(counts, 1);
    expect(counts.result).toStrictEqual({ generationId: "wrun_owned", status: "ready" });
  });

  it("says no run started yet", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    mockSession(user.id);

    await expect(getGoalGenerationId({ goalId: goal.id })).resolves.toStrictEqual({
      generationId: null,
      status: "ready",
    });
  });

  it("never reads another learner's goal or one without a session", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ generationRunId: "wrun_private", userId: owner.id });

    mockSession(other.id);

    await expect(getGoalGenerationId({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(getGoalGenerationId({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
