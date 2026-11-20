"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { revokeCliLoginsForAdmin } from "@zoonk/core/auth/revoke-cli-logins";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function revokeCliLoginsAction(formData: FormData) {
  await assertAdmin();
  const result = await revokeCliLoginsForAdmin(parseFormField(formData, "userId") ?? "");

  if (result.status === "notFound") {
    revalidatePath("/cli-logins");
    return { error: "This person has no CLI logins left. The list now shows it as it is." };
  }

  if (result.status !== "ready") {
    return { error: "Only platform admins can revoke CLI access." };
  }

  revalidatePath("/cli-logins");
  return { error: null };
}
