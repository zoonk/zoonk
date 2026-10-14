"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

const QUICK_EXPLANATION_MINUTES = 5;

/** "Quick explanation · 5 min": the kind and length a quick explanation is named by everywhere. */
export function useQuickExplanationLabel(): string {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return t("Quick explanation · {time}", { time: formatDuration(QUICK_EXPLANATION_MINUTES) });
}
