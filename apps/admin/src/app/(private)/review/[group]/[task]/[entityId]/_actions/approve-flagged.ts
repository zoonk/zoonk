"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType, getTaskPath, isValidTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { redirect } from "next/navigation";

export async function approveFlaggedAction(taskType: ReviewTaskType, entityId: string) {
  const session = await assertAdmin();

  if (!isValidTaskType(taskType)) {
    throw new Error("Invalid task type");
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

  redirect(`${getTaskPath(taskType)}?view=flagged`);
}
