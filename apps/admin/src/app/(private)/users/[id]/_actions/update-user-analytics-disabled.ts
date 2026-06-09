"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

/**
 * Admins need a reversible way to remove internal or test accounts from
 * analytics without changing whether the user can sign in or keep learning.
 */
export async function updateUserAnalyticsDisabledAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId");
  const analyticsDisabled = parseAnalyticsDisabled(parseFormField(formData, "analyticsDisabled"));

  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const { error } = await safeAsync(() =>
    prisma.user.update({ data: { analyticsDisabled }, where: { id: userId } }),
  );

  if (error) {
    throw error;
  }

  revalidateUserAnalyticsPaths({ userId });
}

/**
 * The form sends an explicit string value so the action can reject malformed
 * submissions instead of treating any unexpected value as enabled or disabled.
 */
function parseAnalyticsDisabled(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Invalid analytics setting");
}

/**
 * Updating the flag changes both the user detail page and aggregate admin
 * analytics, so the common dashboard and stats routes should refresh together.
 */
function revalidateUserAnalyticsPaths({ userId }: { userId: string }) {
  revalidatePath(`/users/${userId}`);
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/stats/growth");
  revalidatePath("/stats/engagement");
}
