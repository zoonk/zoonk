"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function banUserAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId");

  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const reason = parseFormField(formData, "reason") || null;
  const expiresRaw = parseFormField(formData, "expires");
  const banExpires = expiresRaw ? new Date(expiresRaw) : null;

  // Better Auth refuses a banned user only new sessions, so the ones they hold end here.
  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.user.update({
        data: { banExpires, banReason: reason, banned: true },
        // Better Auth lifts an expired ban at the next sign-in, which would make an admin staff again.
        where: banExpires
          ? { OR: [{ role: { not: "admin" } }, { role: null }], id: userId }
          : { id: userId },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]),
  );

  if (error) {
    throw error;
  }

  revalidatePath(`/users/${userId}`);
}
