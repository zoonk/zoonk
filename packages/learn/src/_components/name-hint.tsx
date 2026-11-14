"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * The line under a name field: where the name shows, or why it can't be saved. Both are laid out
 * in the same place and one is shown, so the line keeps its height when it changes.
 */
export function NameHint({ isTooLong = false }: { isTooLong?: boolean }) {
  const t = useExtracted();

  return (
    <span className="grid">
      <span
        aria-hidden={isTooLong}
        className={cn("col-start-1 row-start-1", isTooLong && "invisible")}
      >
        {t("Your buddy and all your certificates use this name.")}
      </span>
      <span
        aria-hidden={!isTooLong}
        className={cn("text-destructive-text col-start-1 row-start-1", !isTooLong && "invisible")}
      >
        {t("Use 150 characters or fewer.")}
      </span>
    </span>
  );
}
