"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type WaitState } from "../_utils/wait-state";

/** The status stays in the page while empty, so screen readers announce it when it speaks. */
export function OpeningWaitLine({ className, wait }: { className?: string; wait: WaitState }) {
  const t = useExtracted();

  return (
    <span className={cn("text-muted-foreground", className)} role="status">
      {wait === "slow" && t("Opening your next step…")}
      {wait === "verySlow" &&
        t("This is taking longer than usual. It opens on its own, no need to tap again.")}
    </span>
  );
}
