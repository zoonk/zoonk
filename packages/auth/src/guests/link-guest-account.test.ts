import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { createExistingAccount, signInAsGuest } from "./_test-utils/guest-auth";
import { createGoal } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

describe(linkGuestAccount, () => {
  it("marks the account's and the guest's plans waiting on the linked account, keeping the reasons they had", async () => {
    const [account, guest] = await Promise.all([
      createExistingAccount({ createdAt: new Date() }),
      signInAsGuest(),
    ]);

    const [accountGoal, guestGoal] = await Promise.all([
      createGoal(account.userId),
      createGoal(guest.guestId),
    ]);

    const plans = await Promise.all([
      prisma.plan.create({ data: { goalId: accountGoal.id, pendingAdaptation: ["calendar"] } }),
      prisma.plan.create({ data: { goalId: guestGoal.id } }),
    ]);

    await linkGuestAccount({ account: { id: account.userId }, guestUserId: guest.guestId });

    const linked = await Promise.all(
      plans.map((plan) =>
        prisma.plan.findUniqueOrThrow({
          select: { inputVersion: true, pendingAdaptation: true },
          where: { id: plan.id },
        }),
      ),
    );

    expect(linked).toStrictEqual([
      { inputVersion: plans[0].inputVersion + 1, pendingAdaptation: ["calendar", "account"] },
      { inputVersion: plans[1].inputVersion + 1, pendingAdaptation: ["account"] },
    ]);
  });
});
