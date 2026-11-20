import { type StudyBlockView, type StudySessionView } from "./_utils/session-view";

export const DAY_STATES = ["ahead", "done", "prepare", "rest", "underway", "waiting"] as const;

export const DAY_WAIT_REASONS = ["lessons", "mock"] as const;

export type DayState = (typeof DAY_STATES)[number];

type DayStateInput = Pick<StudySessionView, "emptyDay" | "minutes" | "nextPosition"> & {
  lessonsComing?: boolean;
  lessonsToPrepare?: boolean;
  blocks: readonly (Pick<StudyBlockView, "position" | "status"> & { preparing?: boolean })[];
};

type DayStatus = { state: DayState; waitingFor: (typeof DAY_WAIT_REASONS)[number] | null };

/**
 * A day with no blocks is a rest day, one still being outlined (`waiting`), one whose lessons wait
 * for the learner to ask for them (`prepare`), or one with nothing new (`ahead`): never a finished
 * session.
 */
function getDayState(day: DayStateInput): DayStatus {
  const empty = day.blocks.length === 0;
  const studyDay = empty && day.minutes.dailyGoal > 0;
  const hasNext = day.blocks.some((block) => block.position === day.nextPosition);

  if (studyDay && day.emptyDay === "lessonsComing") {
    return { state: "waiting", waitingFor: "lessons" };
  }

  if (studyDay && day.emptyDay === "lessonsToPrepare") {
    return { state: "prepare", waitingFor: null };
  }

  if (hasNext) {
    return { state: "underway", waitingFor: null };
  }

  if (day.blocks.some((block) => block.status === "pending" && block.preparing)) {
    return { state: "waiting", waitingFor: "mock" };
  }

  if (day.lessonsComing || day.lessonsToPrepare) {
    return { state: "waiting", waitingFor: "lessons" };
  }

  if (studyDay) {
    return { state: "ahead", waitingFor: null };
  }

  return { state: empty && day.minutes.dailyGoal === 0 ? "rest" : "done", waitingFor: null };
}

export function withDayState<Day extends DayStateInput>(day: Day): Day & DayStatus {
  return { ...day, ...getDayState(day) };
}
