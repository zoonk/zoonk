"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { deleteShownAccount } from "@zoonk/core/users/delete-current";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type DeleteAccountResult = "deleted" | "failed" | "otherAccount" | "signInAgain";

const STALE_SESSION_CODES = new Set(["SESSION_EXPIRED", "SESSION_NOT_FRESH"]);

/** Only while it's the account the page showed (`shownUserId`); `otherAccount` otherwise. */
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
