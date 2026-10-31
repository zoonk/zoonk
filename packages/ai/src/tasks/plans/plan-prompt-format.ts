const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatWeek(weekdayMinutes: readonly number[]): string {
  return weekdayMinutes
    .map((minutes, weekday) => `${WEEKDAY_NAMES[weekday]}: ${minutes}`)
    .join(", ");
}

/** With its weekday, so the model resolves "next Monday" from it. */
export function formatToday(today: string): string {
  return `${today} (${WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()]})`;
}

export function formatMemory(memory: readonly string[] | undefined): string {
  return memory && memory.length > 0 ? memory.map((fact) => `- ${fact}`).join("\n") : "none";
}
