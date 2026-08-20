import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";

describe("Apple subscription constraints", () => {
  it("rejects an Apple subscription without a provider chain ID", async () => {
    const user = await userFixture();

    try {
      await expect(
        prisma.subscription.create({
          data: {
            periodEnd: new Date(Date.now() + 86_400_000),
            plan: "plus",
            provider: "apple",
            referenceId: user.id,
            status: "active",
            userId: user.id,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.subscription.deleteMany({
        where: { provider: "apple", providerSubscriptionId: null, referenceId: user.id },
      });
    }
  });
});
