import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../../view-models/_test-utils/course-goal";
import { getGoalUploadRequest } from "./goal-upload-request";
import { listGoalChangeNotices } from "./source-change-notices";

describe("Today source supporting reads", () => {
  it.each([
    ["upload request", getGoalUploadRequest],
    ["change notices", listGoalChangeNotices],
  ] as const)("reads %s without writing", async (_name, read) => {
    const { goal } = await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({ goalId: goal.id }));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
