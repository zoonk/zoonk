import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getActiveSubscription } from "../auth/subscription";
import { listCurrentUserGoals } from "../goals/list-current-user-goals";
import { getCurrentUserMemory } from "../memory/get-current-user-memory";
import { getLearningProfile } from "../profile/get-learning-profile";
import { findGoalStartLimit } from "./find-goal-start-limit";
import { getAllowance } from "./get-allowance";

describe("settings reads", () => {
  it.each([
    ["allowance", getAllowance],
    ["start limit", findGoalStartLimit],
    ["subscription", getActiveSubscription],
    ["goals", listCurrentUserGoals],
    ["profile", getLearningProfile],
    ["memory", getCurrentUserMemory],
  ] as const)("reads %s without writing", async (_name, read) => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read());
    expect(counts.writes).toBe(0);
  });
});
