import { prisma } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { acknowledgeTodayPlanChange } from "./acknowledge-today-plan-change";

async function storedNotice() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const change = await planChangeFixture({
    kind: "missedDays",
    planId: plan.id,
    status: "applied",
  });

  mockSession(user.id);
  return { change, input: { changeId: change.id, kind: "stored" as const }, plan, user };
}

describe(acknowledgeTodayPlanChange, () => {
  it("acknowledges a saved notice once under concurrent taps, without touching its plan", async () => {
    const { plan, change, input } = await storedNotice();

    const results = await Promise.all([
      acknowledgeTodayPlanChange(input),
      acknowledgeTodayPlanChange(input),
    ]);

    expect(results).toStrictEqual(
      Array.from({ length: 2 }, () => ({ changeId: change.id, status: "acknowledged" })),
    );

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      plan,
    );

    const replay = await countDatabaseStatements(() => acknowledgeTodayPlanChange(input));
    expect(replay.writes).toBe(0);
    expect(replay.result).toStrictEqual(results[0]);
  });

  it.each(["foreign", "signedOut"])("refuses %s without writing", async (actor) => {
    const { input } = await storedNotice();
    const stranger = await userFixture();
    mockSession(actor === "foreign" ? stranger.id : null);
    const read = await countDatabaseStatements(() => acknowledgeTodayPlanChange(input));

    expect(read.result).toStrictEqual({
      status: actor === "foreign" ? "notFound" : "unauthorized",
    });

    expect(read.writes).toBe(0);
  });
});
