import { getIsoDay } from "@zoonk/utils/calendar-day";
import { type DateFormat, getIsoDateOptions } from "@zoonk/utils/date-format";
import { type LearnerClock } from "./learner-clock";

/** An instant's calendar day and today's, in the clock's zone, for "Today" and "Yesterday". */
export function getMomentDays({ now, timeZone }: LearnerClock) {
  return {
    dayOf: (moment: Date | string) => getIsoDay({ now: new Date(moment), timeZone }),
    today: getIsoDay({ now, timeZone }),
  };
}

/** Its day and today are read in the clock's zone, so the year shows exactly when the drawn date is in another year. */
export function getMomentDateOptions({
  clock,
  moment,
  role = "row",
  ...options
}: DateFormat & { clock: LearnerClock; moment: Date | string }): Omit<
  ReturnType<typeof getIsoDateOptions>,
  "timeZone"
> & { timeZone: string } {
  const { dayOf, today } = getMomentDays(clock);

  return {
    ...getIsoDateOptions({ ...options, isoDate: dayOf(moment), role, today }),
    timeZone: clock.timeZone,
  };
}
