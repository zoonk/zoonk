"use server";

import { getNextReviewItem } from "@/data/review/get-next-review-item";
import { getTaskPath, isValidTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { redirect } from "next/navigation";

export async function markReviewedAction(formData: FormData) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const taskType = parseFormField(formData, "taskType");
  const entityIdRaw = parseFormField(formData, "entityId");

  if (!taskType || !entityIdRaw || !isValidTaskType(taskType)) {
    throw new Error("Invalid form data");
  }

  const entityId = BigInt(entityIdRaw);
  const userId = Number(session.user.id);

  const { error } = await safeAsync(() =>
    prisma.aiContentReview.upsert({
      create: { entityId, taskType, userId },
      update: { reviewedAt: new Date(), userId },
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
