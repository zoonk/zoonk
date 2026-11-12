import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markPlanRevealed } from "./mark-plan-revealed";

describe(markPlanRevealed, () => {
  it("makes the goal whose plan the learner starts the one they study", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const [studying, revealed] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ planRevealedAt: null, userId: user.id }),
    ]);

    await learningProfileFixture({ activeGoalId: studying.id, userId: user.id });

    await expect(markPlanRevealed(revealed.id)).resolves.toStrictEqual({ status: "ready" });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    expect(profile.activeGoalId).toBe(revealed.id);
  });
});
