import {
  goalFixture,
  planChangeFixture,
  planFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { loadClaimEvents } from "../../learner/_utils/load-skill-claims";

describe("passed-over claims on a fresh read", () => {
  it("reads the plan's change history only when an asked skill was passed over", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const [skipped, asked] = await Promise.all([skillFixture(), skillFixture()]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: { skills: plannedSkills([skipped, asked]) },
      settings: { baseChoices: [{ choice: "skip", skillId: skipped.id }] },
    });

    await planChangeFixture({ kind: "setBaseChoices", planId: plan.id, status: "applied" });

    const read = (skillId: string) =>
      countDatabaseRows(
        () => loadClaimEvents({ goalId: goal.id, skillIds: [skillId], userId: user.id }),
        'WHERE ("public"."plan_changes"."plan_id" = $1 AND "public"."plan_changes"."status"',
      );

    const [unaskedHistory, askedHistory] = await Promise.all([read(asked.id), read(skipped.id)]);

    expect(unaskedHistory).toStrictEqual({ result: [], rows: 0 });
    expect(askedHistory.rows).toBe(1);

    expect(askedHistory.result).toStrictEqual([
      expect.objectContaining({ kind: "claim", skillId: skipped.id }),
    ]);
  });
});
