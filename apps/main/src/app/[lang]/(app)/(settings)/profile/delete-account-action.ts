"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { deleteShownAccount } from "@zoonk/core/users/delete-current";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type DeleteAccountResult = "deleted" | "failed" | "otherAccount" | "signInAgain";

/** Deleting needs a recent sign-in, like other sensitive changes. */
const STALE_SESSION_CODES = new Set(["SESSION_EXPIRED", "SESSION_NOT_FRESH"]);

/**
 * Deletes the signed-in account and everything in it through the same core capability as
 * `DELETE /v1/me`, only while it's the account the page showed (`shownUserId`; `otherAccount`
 * otherwise). A session that isn't recent asks the learner to sign in again first.
 */
export async function deleteAccountAction(shownUserId: unknown): Promise<DeleteAccountResult> {
  if (typeof shownUserId !== "string") {
    return "failed";
  }

  const { data, error } = await safeAsync(() => deleteShownAccount({ shownUserId }));

  if (!error) {
    return data;
  }

  if (STALE_SESSION_CODES.has(getAuthError(error)?.code ?? "")) {
    return "signInAgain";
  }

  logError("[deleteAccountAction] Failed to delete the account:", error);
  return "failed";
}
