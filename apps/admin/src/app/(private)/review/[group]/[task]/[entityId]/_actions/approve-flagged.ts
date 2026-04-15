"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType, getTaskPath, isValidTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseBigIntId } from "@zoonk/utils/number";
import { redirect } from "next/navigation";

export async function approveFlaggedAction(taskType: ReviewTaskType, rawEntityId: string) {
  const session = await assertAdmin();

  if (!isValidTaskType(taskType)) {
    throw new Error("Invalid task type");
  }

  const entityId = parseBigIntId(rawEntityId);

  if (!entityId) {
    throw new Error("Invalid entity ID");
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
