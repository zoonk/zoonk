"use server";

import { randomUUID } from "node:crypto";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { assertAdmin } from "@/lib/admin-guard";
import { type Subscription, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { type SubscriptionPlanName, isSubscriptionPlanName } from "@zoonk/utils/subscription";
import { revalidatePath } from "next/cache";

export async function changePlanAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId");
  const plan = parseFormField(formData, "plan");

  if (!(userId && plan && isSubscriptionPlanName(plan))) {
    throw new Error("Invalid form data");
  }

  const subscriptions = await prisma.subscription.findMany({ where: { referenceId: userId } });

  const existing = findUserActiveSubscription(subscriptions);

  if (existing && existing.provider !== "zoonk") {
    throw new Error("Cannot change plan unless the subscription is Zoonk-managed");
  }

  const { error } = await safeAsync(() => saveManualPlanChange({ existing, plan, userId }));

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}

/**
 * Admin-managed paid plans are stored as Zoonk-owned active subscriptions, but
 * the free plan is the absence of an active subscription. Keeping a
 * Zoonk-managed row for "free" makes the learner billing page treat the account
 * as support-managed and blocks self-serve Stripe upgrades.
 */
async function saveManualPlanChange({
  existing,
  plan,
  userId,
}: {
  existing: Subscription | null;
  plan: SubscriptionPlanName;
  userId: string;
}) {
  if (plan === "free") {
    return prisma.subscription.deleteMany({
      where: { provider: "zoonk", referenceId: userId, status: { in: ["active", "trialing"] } },
    });
  }

  if (existing) {
    return prisma.subscription.update({
      data: { periodStart: new Date(), plan, status: "active" },
      where: { id: existing.id },
    });
  }

  return prisma.subscription.create({
    data: {
      id: randomUUID(),
      periodStart: new Date(),
      plan,
      provider: "zoonk",
      referenceId: userId,
      status: "active",
    },
  });
}
