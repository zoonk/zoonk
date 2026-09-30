"use client";

import { Button } from "@zoonk/ui/components/button";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { cn } from "@zoonk/ui/lib/utils";
import { Share2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Shares the plan's link: the phone's share sheet where there is one, otherwise the link is copied.
 * Whoever opens it sees only the subject and the plan's shape, and can start their own.
 */
export function SharePlanButton({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const t = useExtracted();
  const { goal, shareHref } = usePlanScreen();
  const { copy } = useClipboard();

  const share = async () => {
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

  return (
    <Button
      className={cn(className)}
      onClick={share}
      size={iconOnly ? "icon" : "sm"}
      variant={iconOnly ? "ghost" : "outline"}
    >
      <Share2Icon aria-hidden="true" data-icon={iconOnly ? undefined : "inline-start"} />
      <span className={cn(iconOnly && "sr-only")}>{t("Share this plan")}</span>
    </Button>
  );
}
