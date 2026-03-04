"use server";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseNumericId } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function changePlanAction(formData: FormData) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const userIdRaw = parseFormField(formData, "userId");
  const userId = userIdRaw ? parseNumericId(userIdRaw) : null;
  const plan = parseFormField(formData, "plan");

  if (!userId || !plan) {
    throw new Error("Invalid form data");
  }

  const referenceId = String(userId);

  const existing = await prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: { referenceId },
  });

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
      data: { periodStart: new Date(), plan, referenceId, status: "active" },
    });
  });

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
