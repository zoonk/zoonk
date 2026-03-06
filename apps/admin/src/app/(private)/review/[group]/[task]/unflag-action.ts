"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseBigIntId } from "@zoonk/utils/number";
import { revalidatePath } from "next/cache";

export async function unflagAction(formData: FormData) {
  await assertAdmin();

  const taskType = parseFormField(formData, "taskType");
  const entityIdRaw = parseFormField(formData, "entityId");

  const entityId = entityIdRaw ? parseBigIntId(entityIdRaw) : null;

  if (!taskType || !entityId) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(() =>
    prisma.contentReview.delete({
      where: { taskEntity: { entityId, taskType } },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}
