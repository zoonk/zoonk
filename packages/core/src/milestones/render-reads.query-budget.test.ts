import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getBuddyStatus } from "./get-buddy-status";
import { getWeeklyRecap } from "./get-weekly-recap";

describe("buddy render read budgets", () => {
  it.each([
    ["buddy", getBuddyStatus, 17],
    ["weekly recap", getWeeklyRecap, 7],
  ] as const)("keeps the budget for %s", async (_name, read, budget) => {
    await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({}));
    assertReadBudget(counts, budget);
    expect(counts.result.status).toBe("ready");
  });
});
