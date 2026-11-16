import { getDateInTimeZone } from "../../../packages/utils/src/time-zone.ts";

export function seedClock(timeZone: string) {
  const now = new Date();
  return { localDate: getDateInTimeZone({ date: now, timeZone }), now };
}
