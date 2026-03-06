"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseNumericId } from "@zoonk/utils/number";
import { revalidatePath } from "next/cache";

export async function revokeSessionsAction(formData: FormData) {
  await assertAdmin();

  const userIdRaw = parseFormField(formData, "userId");
  const userId = userIdRaw ? parseNumericId(userIdRaw) : null;

  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const { error } = await safeAsync(() => prisma.session.deleteMany({ where: { userId } }));

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
