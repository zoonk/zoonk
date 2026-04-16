"use server";

import { randomUUID } from "node:crypto";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function changePlanAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId");
  const plan = parseFormField(formData, "plan");

  if (!userId || !plan) {
    throw new Error("Invalid form data");
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { referenceId: userId },
  });

  const existing = findUserActiveSubscription(subscriptions);

  if (existing?.stripeSubscriptionId) {
    throw new Error("Cannot change plan for Stripe-managed subscriptions");
  }

  const { error } = await safeAsync(() => {
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
        referenceId: userId,
        status: "active",
      },
    });
  });

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
