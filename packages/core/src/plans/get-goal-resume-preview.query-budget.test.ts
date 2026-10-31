import { prisma } from "@zoonk/db";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getGoalResumePreview } from "./get-goal-resume-preview";

describe("render read budgets", () => {
  it("keeps the read budget for a paused goal resume preview", async () => {
    const { goal } = await signedInCourseGoal();
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
    const counts = await countDatabaseStatements(() => getGoalResumePreview(goal.id));
    assertReadBudget(counts, 5);
    expect(counts.result.status).toBe("ready");
  });
});
