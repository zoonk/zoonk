import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";

export const DAY_STATES = [
  "ahead",
  "done",
  "limit",
  "prepare",
  "rest",
  "underway",
  "waiting",
] as const;

export type DayState = (typeof DAY_STATES)[number];

type DayStateInput = Pick<
  StudySessionView,
  "dailyLimit" | "emptyDay" | "minutes" | "nextPosition"
> & { blocks: readonly Pick<StudyBlockView, "position" | "status">[] };

/**
 * A day with no blocks is a rest day, one still being outlined (`waiting`), one whose lessons wait
 * for the learner to ask for them (`prepare`), or one with nothing new (`ahead`): never a finished
 * session.
 */
function getDayState(day: DayStateInput): DayState {
  const empty = day.blocks.length === 0;
  const done = !empty && day.nextPosition === null;
  const limitReached = day.dailyLimit?.reached === true;
  const studyDay = empty && !limitReached && day.minutes.dailyGoal > 0;
  const hasNext = day.blocks.some((block) => block.position === day.nextPosition);

  if (studyDay && day.emptyDay === "lessonsComing") {
    return "waiting";
  }

  if (studyDay && day.emptyDay === "lessonsToPrepare") {
    return "prepare";
  }

  if (hasNext && !limitReached) {
    return "underway";
  }

  if (limitReached && !done) {
    return "limit";
  }

  if (studyDay) {
    return "ahead";
  }

  return empty && !limitReached && day.minutes.dailyGoal === 0 ? "rest" : "done";
}

export function withDayState<Day extends DayStateInput>(day: Day): Day & { state: DayState } {
  return { ...day, state: getDayState(day) };
}
