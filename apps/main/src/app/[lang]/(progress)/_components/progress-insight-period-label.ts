import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { getExtracted } from "next-intl/server";

/**
 * Insight card subtitles should describe the selected history window in short,
 * plain language instead of repeating the chart axis label.
 */
export async function getProgressInsightPeriodLabel({
  period,
}: {
  period: HistoryPeriod;
}): Promise<string> {
  const t = await getExtracted();

  if (period === "month") {
    return t("This month");
  }

  if (period === "6months") {
    return t("Past 6 months");
  }

  if (period === "all") {
    return t("All time");
  }

  return t("This year");
}
