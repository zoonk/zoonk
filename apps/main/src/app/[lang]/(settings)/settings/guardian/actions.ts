"use server";

import { guardianInviteSchema } from "@zoonk/core/minors/guardian/contract";
import { inviteGuardian } from "@zoonk/core/minors/guardian/invite";
import { revokeGuardianLink } from "@zoonk/core/minors/guardian/revoke-link";
import { parseFormField } from "@zoonk/utils/form";
import { refresh } from "next/cache";

export type GuardianInviteState = {
  status: "accountRequired" | "error" | "idle" | "invalidEmail" | "invited" | "limitReached";
};

/** Emails the guardian an invite; a new invite replaces one still pending. */
export async function inviteGuardianAction(
  _state: GuardianInviteState,
  formData: FormData,
): Promise<GuardianInviteState> {
  const parsed = guardianInviteSchema.safeParse({ email: parseFormField(formData, "email") });

  if (!parsed.success) {
    return { status: "invalidEmail" };
  }

  const result = await inviteGuardian(parsed.data);

  if (result.status === "invited") {
    refresh();
    return { status: "invited" };
  }

  if (result.status === "invalidEmail" || result.status === "limitReached") {
    return { status: result.status };
  }

  return { status: result.status === "accountRequired" ? "accountRequired" : "error" };
}

/** Cancels an invite the guardian hasn't accepted yet. */
export async function cancelGuardianInviteAction(linkId: string): Promise<boolean> {
  const result = await revokeGuardianLink({ linkId });

  if (result.status === "revoked") {
    refresh();
  }

  return result.status === "revoked";
}
