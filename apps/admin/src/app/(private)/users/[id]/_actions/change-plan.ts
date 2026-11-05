"use server";

import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { assertAdmin } from "@/lib/admin-guard";
import { issueEarnedCertificates } from "@zoonk/auth/certificate-issuance";
import { type Subscription, prisma } from "@zoonk/db";
import { lockLearner } from "@zoonk/db/learner-writes";
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
 * A move to Free ends the paid interval instead of deleting it: conversion analytics need the
 * history, and no active support-managed row is left to block a self-serve Stripe upgrade.
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

  // The learner locks before their subscription row, as in every writer, and the grant issues what they earned.
  return prisma.$transaction(async (tx) => {
    await lockLearner(tx, { userId });

    const saved = existing
      ? await tx.subscription.update({
          data: { plan, status: "active" },
          where: { id: existing.id },
        })
      : await tx.subscription.create({
          data: {
            periodStart: changedAt,
            plan,
            provider: "zoonk",
            referenceId: userId,
            status: "active",
          },
        });

    await issueEarnedCertificates(tx, { now: changedAt, plus: "check", userId });
    return saved;
  });
}
