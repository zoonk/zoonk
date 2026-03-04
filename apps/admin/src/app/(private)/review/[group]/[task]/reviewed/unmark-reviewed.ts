"use server";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function unmarkReviewedAction(formData: FormData) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const taskType = parseFormField(formData, "taskType");
  const entityIdRaw = parseFormField(formData, "entityId");

  if (!taskType || !entityIdRaw) {
    throw new Error("Invalid form data");
  }

  const entityId = BigInt(entityIdRaw);

  const { error } = await safeAsync(() =>
    prisma.aiContentReview.delete({
      where: { taskEntity: { entityId, taskType } },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}
