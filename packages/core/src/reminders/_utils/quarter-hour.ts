const MINUTES_PER_HOUR = 60;
const QUARTER_HOUR = 15;

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

const LAST_QUARTER = toMinutes("23:45");

/** Reminders go out every 15 minutes, so a time between quarters would arrive later than it says. */
export function isQuarterHour(time: string): boolean {
  return toMinutes(time) % QUARTER_HOUR === 0;
}

/** The nearest quarter hour, but never past 23:45, which would move the reminder to the next day. */
export function roundToQuarterHour(time: string): string {
  const minutes = Math.min(Math.round(toMinutes(time) / QUARTER_HOUR) * QUARTER_HOUR, LAST_QUARTER);

  const hours = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0");
  return `${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;
}
