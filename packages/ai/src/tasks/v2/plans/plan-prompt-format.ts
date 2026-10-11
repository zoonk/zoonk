const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Minutes per weekday, Sunday first, as the plan prompts read them ("Sunday: 20, Monday: 20"). */
export function formatWeek(weekdayMinutes: readonly number[]): string {
  return weekdayMinutes
    .map((minutes, weekday) => `${WEEKDAY_NAMES[weekday]}: ${minutes}`)
    .join(", ");
}

/** The learner-local date with its weekday, so the model resolves "next Monday" from it. */
export function formatToday(today: string): string {
  return `${today} (${WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()]})`;
}

/** Memory facts one per line, or `none`. */
export function formatMemory(memory: readonly string[] | undefined): string {
  return memory && memory.length > 0 ? memory.map((fact) => `- ${fact}`).join("\n") : "none";
}
