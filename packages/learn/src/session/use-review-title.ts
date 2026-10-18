"use client";

import { useExtracted } from "next-intl";

/**
 * A review up to this long is a quick one: a few minutes. A longer one, as when reviews pile up or
 * on a day nothing but reviews fills (a free exam plan past its first week), is named plainly, its
 * minutes beside it: "Quick review · 13 min" read as a promise it didn't keep.
 */
const QUICK_REVIEW_MAX_MINUTES = 5;

/** A review by how long it is: "Quick review", or plainly "Reviews" once it takes longer. */
export function useReviewTitle() {
  const t = useExtracted();

  return (minutes: number): string =>
    minutes > QUICK_REVIEW_MAX_MINUTES ? t("Reviews") : t("Quick review");
}
