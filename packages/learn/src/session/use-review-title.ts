"use client";

import { useExtracted } from "next-intl";

/** Past this, "Quick review · 13 min" would read as a promise it didn't keep. */
const QUICK_REVIEW_MAX_MINUTES = 5;

export function useReviewTitle() {
  const t = useExtracted();

  return (minutes: number): string =>
    minutes > QUICK_REVIEW_MAX_MINUTES ? t("Reviews") : t("Quick review");
}
