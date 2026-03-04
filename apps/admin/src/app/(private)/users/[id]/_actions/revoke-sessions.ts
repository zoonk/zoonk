"use server";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { parseNumericId } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function revokeSessionsAction(formData: FormData) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

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
