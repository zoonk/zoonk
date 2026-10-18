import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getOnboarding } from "./get-onboarding";

describe("render read budgets", () => {
  it("keeps the read budget for onboarding display", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getOnboarding({ goalId: goal.id }));
    assertReadBudget(counts, 10);
    expect(counts.result.status).toBe("ready");
  });
});
