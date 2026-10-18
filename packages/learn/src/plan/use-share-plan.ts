"use client";

import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Shares the plan's link: the phone's share sheet where there is one, otherwise the link is copied.
 * Whoever opens it sees only the subject and the plan's shape, and can start their own.
 */
export function useSharePlan() {
  const t = useExtracted();
  const { goal, shareHref } = usePlanScreen();
  const { copy } = useClipboard();

  return async () => {
    const url = new URL(shareHref, globalThis.location.origin).toString();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: goal.title, url });
        return;
      } catch (error) {
        if (isAbort(error)) {
          return;
        }
      }
    }

    await copy(url);
    showSuccessToast(t("Link copied"));
  };
}
