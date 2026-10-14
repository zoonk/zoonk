import { randomUUID } from "node:crypto";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeAll, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedV2, seedV2PersonaCopy } from "../seed/seed-v2";
import { getPlanTabView } from "./plan/get-plan-view";
import { getProgressView } from "./progress/get-progress-view";

describe("render read budgets", () => {
  beforeAll(async () => {
    await seedV2();
  }, 60_000);

  it("measures Plan and progress on a private copy of Ana's full exam plan", async () => {
    const copyKey = randomUUID();

    const user = await seedV2PersonaCopy({
      copyKey,
      email: `perf-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    for (const [_name, read, budget] of [
      ["Ana plan", getPlanTabView, 77],
      ["Ana progress", getProgressView, 137],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Measure separate render invocations against the same immutable persona snapshot.
      const counts = await countDatabaseStatements(async () => read({ goalId: user.goalId }));
      assertReadBudget(counts, budget);
      expect(counts.result.status).toBe("ready");
    }
  });
});
