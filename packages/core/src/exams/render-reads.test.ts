import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { scheduledMockSetup } from "./mocks/_test-utils/scheduled-mock";
import { getMock } from "./mocks/get-mock";
import { getMockOptions } from "./mocks/get-mock-options";
import { getExamView } from "./view/get-exam-view";

describe("exam reads", () => {
  it.each([
    ["exam", getExamView],
    ["mock options", getMockOptions],
  ] as const)("reads %s without writing", async (_name, read) => {
    const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

    const { goal } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read({ goalId: goal.id }));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("reads an unstarted mock without writing", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const { blockId } = await scheduledMockSetup();
    const counts = await countDatabaseStatements(() => getMock(blockId));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
