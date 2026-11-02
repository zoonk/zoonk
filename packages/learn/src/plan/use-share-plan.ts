"use client";

import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Whoever opens the link sees only the subject and the plan's shape. */
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
