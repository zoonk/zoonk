import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getExplanation } from "./get-explanation";

describe("explanation render read budget", () => {
  it("reads a ready explanation without generating or writing", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { question: "How does light move?" },
      kind: "explain",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "check", "summary"] });
    await planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getExplanation({ goalId: goal.id }));
    assertReadBudget(counts, 17);
    expect(counts.result).toMatchObject({ explanation: { status: "ready" }, status: "ready" });
  });
});
