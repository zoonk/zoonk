import { readDayProgress } from "../../../learner/facts/day-progress";
import { toIsoDate } from "../../../plans/planner/plan-calendar";

export async function hasStudiedOn({ localDate, userId }: { localDate: Date; userId: string }) {
  const today = await readDayProgress(userId, toIsoDate(localDate));

  return (today?.timeSpentSeconds ?? 0) > 0;
}
