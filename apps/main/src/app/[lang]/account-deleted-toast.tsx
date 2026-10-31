"use client";

import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent } from "react";

const ACCOUNT_DELETED_KEY = "zoonk:account-deleted";

export function rememberAccountDeleted() {
  try {
    sessionStorage.setItem(ACCOUNT_DELETED_KEY, "1");
  } catch {
    // Nothing to keep: the home page shows without the confirmation.
  }
}

function takeAccountDeleted(): boolean {
  try {
    const deleted = sessionStorage.getItem(ACCOUNT_DELETED_KEY) === "1";
    sessionStorage.removeItem(ACCOUNT_DELETED_KEY);
    return deleted;
  } catch {
    return false;
  }
}

/**
 * The page that deleted the account re-renders while it signs out, so the note is read only on the
 * page the browser loads next.
 */
export function AccountDeletedToast() {
  const t = useExtracted();

  const confirmDeleted = useEffectEvent(() => {
    if (takeAccountDeleted()) {
      showSuccessToast(t("Your account was deleted."));
    }
  });

  useEffect(() => {
    confirmDeleted();
  }, []);

  return null;
}
