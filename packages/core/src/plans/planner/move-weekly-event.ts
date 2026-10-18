import { daysBetween, fromIsoDate, getWeekdayMinutes } from "./plan-calendar";
import { DAYS_PER_WEEK, type PlanState } from "./plan-state";

type OperationResult = { error: "badMove" | "pastDate" } | { state: PlanState };

/**
 * "Move to Monday": the week's checkpoint or mock goes to a later day, at most a week later and
 * before the goal's date (a mock moved onto or past the test day no longer prepares for it).
 * Moving the same day again replaces the earlier move, and undo brings it back.
 */
export function moveWeeklyEvent({
  from,
  state,
  to,
  today,
}: {
  from: string;
  state: PlanState;
  to: string;
  today: string;
}): OperationResult {
  if (from < today) {
    return { error: "pastDate" };
  }

  const days = daysBetween(fromIsoDate(from), fromIsoDate(to));
  const { targetDate } = state.goal;

  const minutes = getWeekdayMinutes({
    calendar: {
      dailyMinutes: state.goal.dailyMinutes,
      weekdayMinutes: state.settings.weekdayMinutes,
    },
    weekday: fromIsoDate(to).getUTCDay(),
  });

  if (days < 1 || days > DAYS_PER_WEEK || (targetDate && to >= targetDate) || minutes <= 0) {
    return { error: "badMove" };
  }

  const others = state.settings.movedEvents.filter((move) => move.from !== from);

  return {
    state: { ...state, settings: { ...state.settings, movedEvents: [...others, { from, to }] } },
  };
}
