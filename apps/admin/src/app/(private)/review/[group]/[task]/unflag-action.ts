"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { getTaskPath, isValidTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseBigIntId } from "@zoonk/utils/number";
import { redirect } from "next/navigation";

/**
 * Moves a flagged item back into the pending review queue.
 *
 * We delete the review row instead of updating its status because pending items
 * are defined by the absence of a `contentReview` record. The delete must be
 * idempotent so stale flagged pages or double submissions do not crash.
 */
export async function unflagAction(formData: FormData) {
  await assertAdmin();

  const taskType = parseFormField(formData, "taskType");
  const entityIdRaw = parseFormField(formData, "entityId");

  const entityId = entityIdRaw ? parseBigIntId(entityIdRaw) : null;

  if (!taskType || !entityId || !isValidTaskType(taskType)) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(() =>
    prisma.contentReview.deleteMany({
      where: { entityId, taskType },
    }),
  );

  if (error) {
    throw error;
  }

  redirect(`${getTaskPath(taskType)}?current=${entityId}`);
}
