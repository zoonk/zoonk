"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseNumericId } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function unbanUserAction(formData: FormData) {
  await assertAdmin();

  const userIdRaw = parseFormField(formData, "userId");
  const userId = userIdRaw ? parseNumericId(userIdRaw) : null;

  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const { error } = await safeAsync(() =>
    prisma.user.update({
      data: { banExpires: null, banReason: null, banned: false },
      where: { id: userId },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
