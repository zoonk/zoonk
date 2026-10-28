"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

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

function parseAnalyticsDisabled(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Invalid analytics setting");
}

function revalidateUserAnalyticsPaths({ userId }: { userId: string }) {
  revalidatePath(`/users/${userId}`);
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/stats/growth");
  revalidatePath("/stats/engagement");
  revalidatePath("/subscriptions");
}
