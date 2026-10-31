import { randomUUID } from "node:crypto";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it } from "vitest";
import { mockGuestSession, mockSession, mockSessionFailure } from "../../_test-utils/mock-session";
import { getOwnedGoal } from "../get-owned-goal";
import { readOwnedGoal } from "./owned-goal";

describe("owned goal request facts", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("keys the complete goal by both the derived actor and resource", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ userId: owner.id });

    await expect(readOwnedGoal(owner.id, goal.id)).resolves.toStrictEqual(goal);
    await expect(readOwnedGoal(other.id, goal.id)).resolves.toBeNull();
    await expect(readOwnedGoal(owner.id, randomUUID())).resolves.toBeNull();

    mockSession(owner.id);

    await expect(getOwnedGoal(goal.id)).resolves.toStrictEqual({
      goal,
      status: "ready",
      userId: owner.id,
    });

    mockSession(other.id);
    await expect(getOwnedGoal(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getOwnedGoal(randomUUID())).resolves.toStrictEqual({ status: "notFound" });
  });

  it("keeps visitors unauthorized and rejects malformed IDs without a query", async () => {
    const visitor = await countDatabaseStatements(() => getOwnedGoal(randomUUID()));
    expect(visitor).toMatchObject({ result: { status: "unauthorized" }, statements: 0, writes: 0 });

    const owner = await userFixture();
    mockSession(owner.id);
    const malformed = await countDatabaseStatements(() => getOwnedGoal("not-a-goal"));
    expect(malformed).toMatchObject({ result: { status: "notFound" }, statements: 0, writes: 0 });
  });

  it("lets a guest read only their own goal and propagates session failures", async () => {
    const guest = await userFixture();
    const goal = await goalFixture({ userId: guest.id });
    mockGuestSession(guest.id);

    await expect(getOwnedGoal(goal.id)).resolves.toMatchObject({
      goal: { id: goal.id },
      status: "ready",
    });

    const error = new Error("session unavailable");
    mockSessionFailure(error);
    await expect(getOwnedGoal(goal.id)).rejects.toBe(error);
  });
});
