"use server";

import { dismissGuardianInvite } from "@zoonk/core/minors/guardian/dismiss-invite";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * "Not now" to inviting a guardian on Today: the same core capability as
 * `POST /v1/me/guardian-invite-dismissals`.
 */
export async function dismissGuardianInviteAction(): Promise<boolean> {
  const { data: result, error } = await safeAsync(() => dismissGuardianInvite());

  if (error) {
    logError("[dismissGuardianInviteAction] Failed to put the guardian invite away:", error);
    return false;
  }

  return result.status === "dismissed";
}
