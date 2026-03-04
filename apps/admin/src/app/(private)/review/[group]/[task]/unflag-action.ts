"use server";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseBigIntId } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function unflagAction(formData: FormData) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

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
