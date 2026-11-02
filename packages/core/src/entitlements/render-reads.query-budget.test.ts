import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getActiveSubscription } from "../auth/subscription";
import { listCurrentUserGoals } from "../goals/list-current-user-goals";
import { getCurrentUserMemory } from "../memory/get-current-user-memory";
import { getLearningProfile } from "../profile/get-learning-profile";
import { findGoalStartLimit } from "./find-goal-start-limit";
import { getAllowance } from "./get-allowance";

describe("settings read budgets", () => {
  it.each([
    ["allowance", getAllowance, 8],
    ["start limit", findGoalStartLimit, 10],
    ["subscription", getActiveSubscription, 1],
    ["goals", listCurrentUserGoals, 6],
    ["profile", getLearningProfile, 2],
    ["memory", getCurrentUserMemory, 2],
  ] as const)("keeps the read budget for %s", async (_name, read, budget) => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read());
    assertReadBudget(counts, budget);
    expect(counts.statements).toBeGreaterThan(0);
  });
});
