import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { findGoalStartLimit } from "./find-goal-start-limit";

describe(findGoalStartLimit, () => {
  it("says a free learner following three goals can't start another, while quick questions don't count", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all([
      goalFixture({ kind: "explain", status: "active", userId: user.id }),
      goalFixture({ status: "active", userId: user.id }),
      goalFixture({ status: "active", userId: user.id }),
    ]);

    await expect(findGoalStartLimit()).resolves.toBeNull();

    await goalFixture({ status: "active", userId: user.id });

    await expect(findGoalStartLimit()).resolves.toStrictEqual({
      limit: 3,
      period: "total",
      resource: "activeGoals",
      tier: "free",
    });
  });

  it("names the goals followed before the day's new goals, and the day's once one is paused", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const [goal] = await Promise.all([
      goalFixture({ status: "active", userId: user.id }),
      goalFixture({ status: "active", userId: user.id }),
      goalFixture({ status: "active", userId: user.id }),
      usageRecordsFixture({ count: 3, kind: "goal", userId: user.id }),
    ]);

    await expect(findGoalStartLimit()).resolves.toMatchObject({ resource: "activeGoals" });

    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(findGoalStartLimit()).resolves.toStrictEqual({
      limit: 3,
      period: "day",
      resource: "goal",
      tier: "free",
    });
  });

  it("leaves room once the learner's goal is paused", async () => {
    const user = await userFixture();
    mockSession(user.id);
    await goalFixture({ status: "paused", userId: user.id });

    await expect(findGoalStartLimit()).resolves.toBeNull();
  });

  it("says a guest's one goal is taken", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    await expect(findGoalStartLimit()).resolves.toBeNull();
    await usageRecordsFixture({ count: 1, kind: "goal", userId: guest.id });

    await expect(findGoalStartLimit()).resolves.toMatchObject({ tier: "guest" });
  });
});
