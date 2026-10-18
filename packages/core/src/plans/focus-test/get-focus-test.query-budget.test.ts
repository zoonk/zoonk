import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getFocusTest } from "./get-focus-test";

describe("render read budgets", () => {
  it("keeps the read budget for focus-test display", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 2,
      phases: [4, 4],
      userId: user.id,
    });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ name: "Basics" }],
          skills: skills.map((skill, index) => ({
            area: index < 4 ? "Law" : "Math",
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          })),
        },
      },
      where: { id: plan.id },
    });

    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getFocusTest({ goalId: goal.id }));
    assertReadBudget(counts, 7);
    expect(counts.result.status).toBe("ready");
  });
});
