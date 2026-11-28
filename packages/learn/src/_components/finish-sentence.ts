"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

/** When a plan that studies past its exam finishes, in one sentence. */
export function useFinishSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({ endDate }: { endDate: string }): string =>
    t("You finish around {month}.", {
      month: formatDate(endDate, "sentenceMonth", { year: "always" }),
    });
}
