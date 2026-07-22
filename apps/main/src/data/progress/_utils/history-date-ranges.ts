import "server-only";
import {
  type HistoryPeriod,
  calculateDateRanges,
  calculateFullPeriodDateRanges,
} from "@zoonk/utils/date-ranges";

export async function getDateRanges({ offset, period }: { offset: number; period: HistoryPeriod }) {
  "use cache";

  return calculateDateRanges(period, offset);
}

export async function getFullPeriodDateRanges({
  offset,
  period,
}: {
  offset: number;
  period: HistoryPeriod;
}) {
  "use cache";

  return calculateFullPeriodDateRanges({ offset, period });
}
