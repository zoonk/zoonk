"use client";

import { useExtracted } from "next-intl";

/** The line under a name field: where the name shows, or why it can't be saved. */
export function NameHint({ isTooLong = false }: { isTooLong?: boolean }) {
  const t = useExtracted();

  if (isTooLong) {
    return <span className="text-destructive-text">{t("Use 150 characters or fewer.")}</span>;
  }

  return t("Your buddy and all your certificates use this name.");
}
