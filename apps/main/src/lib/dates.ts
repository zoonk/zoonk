import { getIsoDay } from "@zoonk/utils/calendar-day";
import { type DateFormat, getIsoDateOptions } from "@zoonk/utils/date-format";
import { getFormatter, getTimeZone } from "next-intl/server";

/**
 * An instant (a timestamp) on a server page, written for the place it has and read in the
 * request's zone. The caller says whether the year shows, so nothing here reads the clock.
 */
export async function getMomentDateFormatter(): Promise<
  (moment: Date, format: DateFormat & { year: "always" | "never" }) => string
> {
  const [format, timeZone] = await Promise.all([getFormatter(), getTimeZone()]);

  return (moment, { role = "row", ...options }) => {
    const isoDate = getIsoDay({ now: moment, timeZone });

    return format.dateTime(moment, {
      ...getIsoDateOptions({ ...options, isoDate, role, today: isoDate }),
      timeZone,
    });
  };
}
