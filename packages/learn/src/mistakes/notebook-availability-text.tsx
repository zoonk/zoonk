"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { useExtracted } from "next-intl";

/** One answer to "can I practice now?"; the tabs hold the totals. */
export function NotebookAvailabilityText({ availability }: { availability: MistakeAvailability }) {
  const t = useExtracted();
  const { ready, tomorrow } = availability;

  if (ready > 0) {
    return (
      <span>
        {t(
          "{count, plural, =0 {# ready to practice} one {# ready to practice} other {# ready to practice}}",
          { count: ready },
        )}
      </span>
    );
  }

  return tomorrow > 0 ? <span>{t("Practice opens tomorrow")}</span> : null;
}
