import { addDays, getEndOfWeek } from "./plan-calendar";

/** Dates are UTC-midnight labels of learner-local days, not instants in UTC. */
export function isWeeklyMoveDateAllowed({ to, today }: { to: Date; today: Date }): boolean {
  return to >= addDays(getEndOfWeek(today), 1);
}
