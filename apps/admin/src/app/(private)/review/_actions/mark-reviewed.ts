"use server";

import { getNextReviewItem } from "@/data/review/get-next-review-item";
import { assertAdmin } from "@/lib/admin-guard";
import { getTaskPath, isValidTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { redirect } from "next/navigation";

export async function markReviewedAction(formData: FormData) {
  const session = await assertAdmin();

  const taskType = parseFormField(formData, "taskType");
  const entityId = parseFormField(formData, "entityId");

  if (!taskType || !entityId || !isValidTaskType(taskType)) {
    throw new Error("Invalid form data");
  }
  const userId = session.user.id;

  const { error } = await safeAsync(() =>
    prisma.contentReview.upsert({
      create: { entityId, status: "approved", taskType, userId },
      update: { reviewedAt: new Date(), status: "approved", userId },
      where: { taskEntity: { entityId, taskType } },
    }),
  );

  if (error) {
    throw error;
  }

  const next = await getNextReviewItem(taskType);
  const basePath = getTaskPath(taskType);

  if (next.entityId) {
    redirect(`${basePath}?current=${next.entityId}`);
  }

  redirect(basePath);
}
