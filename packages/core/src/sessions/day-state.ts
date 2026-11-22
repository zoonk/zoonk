import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";

export const DAY_STATES = ["ahead", "done", "prepare", "rest", "underway", "waiting"] as const;

export type DayState = (typeof DAY_STATES)[number];

type DayStateInput = Pick<StudySessionView, "emptyDay" | "minutes" | "nextPosition"> & {
  endedAt?: Date | null;
  lessonsComing?: boolean;
  lessonsToPrepare?: boolean;
  blocks: readonly Pick<StudyBlockView, "position" | "status">[];
};

/**
 * A day with no blocks is a rest day, one still being outlined (`waiting`), one whose lessons wait
 * for the learner to ask for them (`prepare`), or one with nothing new (`ahead`): never a finished
 * session. A started day whose time holds lessons not written yet waits only while someone is
 * outlining them; otherwise it asks, so it never waits on nobody.
 */
function getDayState(day: DayStateInput): DayState {
  if (day.endedAt) {
    return "done";
  }

  const empty = day.blocks.length === 0;
  const studyDay = empty && day.minutes.dailyGoal > 0;
  const hasNext = day.blocks.some((block) => block.position === day.nextPosition);

  if (studyDay && day.emptyDay === "lessonsComing") {
    return "waiting";
  }

  if (studyDay && day.emptyDay === "lessonsToPrepare") {
    return "prepare";
  }

  if (hasNext) {
    return "underway";
  }

  if (day.lessonsComing) {
    return "waiting";
  }

  if (day.lessonsToPrepare) {
    return "prepare";
  }

  if (studyDay) {
    return "ahead";
  }

  return empty && day.minutes.dailyGoal === 0 ? "rest" : "done";
}

export function withDayState<Day extends DayStateInput>(
  day: Day,
  endedAt?: Date | null,
): Day & { state: DayState } {
  return { ...day, state: getDayState({ ...day, endedAt: endedAt ?? day.endedAt }) };
}
