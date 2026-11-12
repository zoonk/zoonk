"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { useExtracted } from "next-intl";

/** The Practice button says mistakes are ready; this line only says why the button is missing. */
export function NotebookAvailabilityText({ availability }: { availability: MistakeAvailability }) {
  const t = useExtracted();
  const { ready, tomorrow } = availability;

  return ready === 0 && tomorrow > 0 ? <span>{t("Practice opens tomorrow")}</span> : null;
}
