"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type AdminActionState } from "@/lib/use-admin-action-state";
import { revokeCliLoginsForAdmin } from "@zoonk/core/auth/revoke-cli-logins";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function revokeCliLoginsAction(
  previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const result = await revokeCliLoginsForAdmin(parseFormField(formData, "userId") ?? "");

  if (result.status === "notFound") {
    revalidatePath("/cli-logins");

    return {
      error: "This person has no CLI logins left. The list now shows it as it is.",
      submissionId,
    };
  }

  if (result.status !== "ready") {
    return { error: "Only platform admins can revoke CLI logins.", submissionId };
  }

  revalidatePath("/cli-logins");
  return { error: null, submissionId };
}
