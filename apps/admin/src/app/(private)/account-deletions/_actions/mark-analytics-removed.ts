"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

/**
 * Records that an admin deleted this account's person in PostHog. Only a pending row changes, so
 * a second click keeps the first time it was marked.
 */
export async function markAnalyticsRemovedAction(formData: FormData) {
  await assertAdmin();

  const deletionId = parseFormField(formData, "deletionId");

  if (!isUuid(deletionId)) {
    throw new Error("Invalid account deletion");
  }

  await prisma.accountDeletion.updateMany({
    data: { analyticsRemovedAt: new Date() },
    where: { analyticsRemovedAt: null, id: deletionId },
  });

  revalidatePath("/account-deletions");
}
