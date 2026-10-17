import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { scheduledMockSetup } from "./mocks/_test-utils/scheduled-mock";
import { getMock } from "./mocks/get-mock";
import { getMockOptions } from "./mocks/get-mock-options";
import { getExamView } from "./view/get-exam-view";

describe("exam read budgets", () => {
  it.each([
    ["exam", getExamView, 61],
    ["mock options", getMockOptions, 32],
  ] as const)("keeps the read budget for %s", async (_name, read, budget) => {
    const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

    const { goal } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read({ goalId: goal.id }));
    assertReadBudget(counts, budget);
    expect(counts.result.status).toBe("ready");
  });

  it("keeps the read budget for an unstarted mock", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const { blockId } = await scheduledMockSetup();
    const counts = await countDatabaseStatements(() => getMock(blockId));
    assertReadBudget(counts, 29);
    expect(counts.result.status).toBe("ready");
  });
});
