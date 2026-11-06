import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { loadFirstSteps } from "./missions/first-steps";

describe(loadFirstSteps, () => {
  it("reads the account's first-step history without changing it", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const counts = await countDatabaseStatements(() =>
      loadFirstSteps({
        candidates: [],
        goal,
        hasEssays: false,
        items: [],
        now: new Date(),
        tier: "free",
        timeZone: "UTC",
        userId: user.id,
      }),
    );

    expect(counts.result).toMatchObject({ done: 0, total: 4 });
    expect(counts.writes).toBe(0);
  });
});
