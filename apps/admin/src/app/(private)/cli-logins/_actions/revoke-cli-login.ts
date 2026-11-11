"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type AdminActionState } from "@/lib/use-admin-action-state";
import { revokeCliLoginForAdmin } from "@zoonk/core/auth/revoke-cli-login";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function revokeCliLoginAction(
  previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const result = await revokeCliLoginForAdmin(parseFormField(formData, "loginId") ?? "");

  if (result.status === "notFound") {
    revalidatePath("/cli-logins");

    return {
      error:
        "This login renewed itself or ended since the page loaded. The list now shows it as it is.",
      submissionId,
    };
  }

  if (result.status !== "ready") {
    return { error: "Only platform admins can revoke CLI logins.", submissionId };
  }

  revalidatePath("/cli-logins");
  return { error: null, submissionId };
}
