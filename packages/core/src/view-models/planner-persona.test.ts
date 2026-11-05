import { randomUUID } from "node:crypto";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedPersonaCopy } from "../seed/seed";
import { getPlanTabView } from "./plan/get-plan-view";
import { getProgressView } from "./progress/get-progress-view";

describe("full persona plan reads", () => {
  it("reads Plan and progress on a private copy of Ana's full exam plan without writing", async () => {
    const copyKey = randomUUID();

    const user = await seedPersonaCopy({
      copyKey,
      email: `perf-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    const views = await Promise.all(
      [getPlanTabView, getProgressView].map((read) =>
        countDatabaseStatements(async () => read({ goalId: user.goalId })),
      ),
    );

    expect(views.map(({ result, writes }) => [result.status, writes])).toStrictEqual([
      ["ready", 0],
      ["ready", 0],
    ]);
  });
});
