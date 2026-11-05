import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getOnboarding } from "./get-onboarding";

describe(getOnboarding, () => {
  it("reads onboarding display without writing", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ details: { answered: [] }, userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getOnboarding({ goalId: goal.id }));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
