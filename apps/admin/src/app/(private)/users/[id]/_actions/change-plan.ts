"use server";

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
 * Admin-managed paid plans are stored as Zoonk-owned active subscriptions. A
 * move to Free ends the paid interval instead of deleting it, preserving the
 * history needed by conversion analytics while still leaving no active
 * support-managed subscription to block self-serve Stripe upgrades.
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
  const changedAt = new Date();

  if (plan === "free") {
    return prisma.subscription.updateMany({
      data: { canceledAt: changedAt, endedAt: changedAt, periodEnd: changedAt, status: "canceled" },
      where: { provider: "zoonk", referenceId: userId, status: { in: ["active", "trialing"] } },
    });
  }

  if (existing) {
    return prisma.subscription.update({
      data: { plan, status: "active" },
      where: { id: existing.id },
    });
  }

  return prisma.subscription.create({
    data: {
      periodStart: changedAt,
      plan,
      provider: "zoonk",
      referenceId: userId,
      status: "active",
    },
  });
}
