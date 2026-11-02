import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getChapterTestOut } from "./get-chapter-test-out";

describe("render read budgets", () => {
  it("keeps the read budget for chapter test-out display", async () => {
    const user = await userFixture();

    const { goal, chapters } = await learnerGoalFixture({
      itemsPerSkill: 2,
      phases: [4, 2],
      userId: user.id,
    });

    mockSession(user.id);

    const counts = await countDatabaseStatements(async () =>
      getChapterTestOut({ chapterId: chapters[0]!.id, goalId: goal.id }),
    );

    assertReadBudget(counts, 20);
    expect(counts.result.status).toBe("ready");
  });
});
