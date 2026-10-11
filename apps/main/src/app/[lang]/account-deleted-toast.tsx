"use client";

import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent } from "react";

const ACCOUNT_DELETED_KEY = "zoonk:account-deleted";

/**
 * Remembers in this tab that the account was just deleted, so the page the browser loads next
 * confirms it. Storage can be unavailable (private windows, blocked storage); then the learner
 * lands on the home page without the confirmation.
 */
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
 * Confirms a deleted account on the page the learner lands on. Deleting reloads the browser so it
 * starts fresh without the old session, so the confirmation can't show before it: the deletion
 * leaves a note (`rememberAccountDeleted`) that the next page reads once, as it loads. Only then:
 * the page that deleted the account re-renders while it signs out, and reading the note there
 * would show the confirmation on a page about to go away.
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
