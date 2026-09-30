"use client";

import { useExtracted } from "next-intl";

/** Plan controls share one quiet message when a change couldn't be saved. */
export function PlanFailedMessage() {
  const t = useExtracted();

  return (
    <p className="text-destructive text-sm" role="alert">
      {t("That didn't work. Try again in a moment.")}
    </p>
  );
}
