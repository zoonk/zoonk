import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getChapterTestOut } from "./get-chapter-test-out";

describe(getChapterTestOut, () => {
  it("reads chapter test-out display without writing", async () => {
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

    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
