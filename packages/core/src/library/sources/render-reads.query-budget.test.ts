import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../../view-models/_test-utils/course-goal";
import { getGoalUploadRequest } from "./goal-upload-request";
import { listGoalChangeNotices } from "./source-change-notices";

describe("Today source supporting read budgets", () => {
  it.each([
    ["upload request", getGoalUploadRequest, 1],
    ["change notices", listGoalChangeNotices, 4],
  ] as const)("reads %s", async (_name, read, budget) => {
    const { goal } = await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({ goalId: goal.id }));
    assertReadBudget(counts, budget);
    expect(counts.result.status).toBe("ready");
  });
});
