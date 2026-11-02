import { getContributionCalendarDateRange } from "@zoonk/utils/contribution-calendar";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";

const SCORE_LOOKBACK_DAY_OFFSET = DEFAULT_PROGRESS_LOOKBACK_DAYS - 1;

/** Learner-local date labels stored at UTC midnight; bounds are inclusive. */
export type ScoreDateRange = { endDate: Date; startDate: Date };

/** Exactly 90 learner-local dates, including today. */
export function getScoreDateRange({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}): ScoreDateRange {
  const { endDate } = getContributionCalendarDateRange({ now, timeZone });
  const startDate = new Date(endDate.getTime() - SCORE_LOOKBACK_DAY_OFFSET * MS_PER_DAY);

  return { endDate, startDate };
}
