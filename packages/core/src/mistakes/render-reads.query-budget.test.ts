import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getMistakePractice } from "./get-mistake-practice";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

describe("mistake read budgets", () => {
  it.each(["practice", "list"] as const)("keeps the read budget for %s", async (name) => {
    const user = await userFixture();

    const { goal, skills, items } = await learnerGoalFixture({
      itemsPerSkill: 3,
      phases: [2],
      userId: user.id,
    });

    await mistakeFixture({
      cause: "gap",
      createdAt: new Date(Date.now() - 86_400_000),
      itemId: items[0]!.id,
      skillId: skills[0]!.id,
      userId: user.id,
    });

    mockSession(user.id);

    const counts = await countDatabaseStatements(async () =>
      name === "practice"
        ? getMistakePractice({ goalId: goal.id, timeZone: "UTC" })
        : listCurrentUserMistakes({ goalId: goal.id, limit: 50, offset: 0, status: "open" }),
    );

    assertReadBudget(counts, name === "practice" ? 24 : 32);
    expect(counts.result.status).toBe("ready");
  });
});
