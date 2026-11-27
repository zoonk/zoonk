import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { findReachedUsageLimit } from "../entitlements/_utils/reached-usage-limit";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { seedPersonaCopy } from "./seed";

describe("a persona's copy in a named scenario state", () => {
  it("is past its reveal: onboarding owes the plan's reveal again", async () => {
    const { goalId } = await seedPersonaCopy({
      copyKey: crypto.randomUUID().slice(0, 8),
      email: `reveal-${crypto.randomUUID()}@zoonk.test`,
      persona: "hugeGoal",
      state: "reveal",
    });

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(goal.planRevealedAt).toBeNull();
  });

  it("is at its level check: onboarding owes placement, then the plan's reveal", async () => {
    const { goalId, userId } = await seedPersonaCopy({
      copyKey: crypto.randomUUID().slice(0, 8),
      email: `placement-${crypto.randomUUID()}@zoonk.test`,
      persona: "stocks",
      state: "placement",
    });

    mockSession(userId);
    const result = await getOnboarding({ goalId });

    expect(result.status === "ready" && result.onboarding.steps).toStrictEqual([
      "placement",
      "plan",
    ]);
  });

  it("has used up the free lessons or the day's mind maps, as the product's own check reads it", async () => {
    const used = await Promise.all(
      (["lessons-used-up", "maps-used-up"] as const).map(async (state) => {
        const { userId } = await seedPersonaCopy({
          copyKey: crypto.randomUUID().slice(0, 8),
          email: `${state}-${crypto.randomUUID()}@zoonk.test`,
          persona: "hugeGoal",
          state,
        });

        const kind = state === "lessons-used-up" ? "lessonStart" : "mindMap";
        return findReachedUsageLimit({ kind, tier: "free", userId });
      }),
    );

    expect(used.every((limit) => limit !== null)).toBe(true);
  });
});
