import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { holdLearnerRevision, waitForBlockedStatement } from "../_test-utils/learner-revision";
import { type VerifiedAppleSubscription } from "./apple-store-payload";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";

const PRODUCT = { billingInterval: "month", plan: "plus" } as const;
const SIGNED_AT = new Date("2026-10-15T00:00:00Z");

function verified(userId: string): VerifiedAppleSubscription {
  return {
    accountToken: userId,
    environment: "sandbox",
    eventId: randomUUID(),
    eventSignedDate: SIGNED_AT,
    expirationDate: new Date("2099-01-01T00:00:00Z"),
    isActive: true,
    isAutoRenewEnabled: true,
    originalTransactionId: randomUUID(),
    productId: "com.zoonk.plus.monthly",
    purchaseDate: new Date("2026-10-01T00:00:00Z"),
    revocationDate: null,
    transactionId: randomUUID(),
    transactionSignedDate: SIGNED_AT,
  };
}

async function learner() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  return { plan, user };
}

async function versions({ planId, userId }: { planId: string; userId: string }) {
  const [plan, user] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  return { inputs: plan.inputVersion, revision: user.learnerRevision };
}

describe("Apple entitlement writer revisions", () => {
  it("marks a new entitlement and a renewal once, leaving replays and stale events unchanged", async () => {
    const { plan, user } = await learner();
    const state = verified(user.id);
    const before = await versions({ planId: plan.id, userId: user.id });
    const input = { product: PRODUCT, referenceId: user.id, verifiedSubscription: state };

    await reconcileAppleSubscription(input);
    await reconcileAppleSubscription(input);

    await expect(versions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputs: before.inputs + 1,
      revision: before.revision + 1n,
    });

    await reconcileAppleSubscription({
      ...input,
      verifiedSubscription: {
        ...state,
        eventId: randomUUID(),
        eventSignedDate: new Date(SIGNED_AT.getTime() + 1000),
        isActive: false,
      },
    });

    await reconcileAppleSubscription(input);

    await expect(versions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputs: before.inputs + 2,
      revision: before.revision + 2n,
    });
  });

  it("serializes duplicate first deliveries without a losing marker", async () => {
    const { plan, user } = await learner();
    const before = await versions({ planId: plan.id, userId: user.id });

    const input = {
      product: PRODUCT,
      referenceId: user.id,
      verifiedSubscription: verified(user.id),
    };

    const [first, second] = await Promise.all([
      reconcileAppleSubscription(input),
      reconcileAppleSubscription(input),
    ]);

    expect(first.id).toBe(second.id);

    await expect(versions({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      inputs: before.inputs + 1,
      revision: before.revision + 1n,
    });
  });

  it("marks before inserting the subscription", async () => {
    const { plan, user } = await learner();
    const state = verified(user.id);
    const holder = holdLearnerRevision({ userId: user.id });
    const pid = await holder.pid;

    const writing = reconcileAppleSubscription({
      product: PRODUCT,
      referenceId: user.id,
      verifiedSubscription: state,
    });

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);

      await expect(
        prisma.subscription.count({
          where: { providerSubscriptionId: state.originalTransactionId },
        }),
      ).resolves.toBe(0);
    } finally {
      holder.release();
      await holder.done;
      await writing;
    }

    await expect(versions({ planId: plan.id, userId: user.id })).resolves.toMatchObject({
      revision: 2n,
    });
  });

  it("rolls back the refused owner's mark when a subscription belongs to another account", async () => {
    const [owner, other] = await Promise.all([learner(), learner()]);
    const state = verified(owner.user.id);

    await reconcileAppleSubscription({
      product: PRODUCT,
      referenceId: owner.user.id,
      verifiedSubscription: state,
    });

    const before = await versions({ planId: other.plan.id, userId: other.user.id });

    await expect(
      reconcileAppleSubscription({
        product: PRODUCT,
        referenceId: other.user.id,
        verifiedSubscription: state,
      }),
    ).rejects.toMatchObject({ reason: "conflict" });

    await expect(versions({ planId: other.plan.id, userId: other.user.id })).resolves.toStrictEqual(
      before,
    );
  });
});
