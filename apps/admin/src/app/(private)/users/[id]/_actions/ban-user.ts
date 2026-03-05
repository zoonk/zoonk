"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseNumericId } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function banUserAction(formData: FormData) {
  await assertAdmin();

  const userIdRaw = parseFormField(formData, "userId");
  const userId = userIdRaw ? parseNumericId(userIdRaw) : null;

  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const reason = parseFormField(formData, "reason") || null;
  const expiresRaw = parseFormField(formData, "expires");
  const banExpires = expiresRaw ? new Date(expiresRaw) : null;

  const { error } = await safeAsync(() =>
    prisma.user.update({
      data: { banExpires, banReason: reason, banned: true },
      where: { id: userId },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
