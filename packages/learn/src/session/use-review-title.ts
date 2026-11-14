"use client";

import { useExtracted } from "next-intl";

/** One name for every review, short or long. */
export function useReviewTitle() {
  const t = useExtracted();
  return (): string => t("Review");
}
