import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { getSessionDayMinutes } from "../fresh-start";
import { type DayOutlines } from "./outlining-stand-ins";
import { type EmptyDay } from "./session-view";

/** Pending lessons must not turn a rest day into an awaiting-content day. */
function toEmptyDay({
  dayMinutes,
  outlines,
}: {
  dayMinutes: number;
  outlines: DayOutlines;
}): EmptyDay | null {
  if (dayMinutes === 0) {
    return null;
  }

  if (outlines === "awaiting") {
    return "lessonsComing";
  }

  return outlines === "idle" ? "lessonsToPrepare" : "nothingNew";
}

/** Room as the session builder fills it: its day's minutes, capped by the learner's daily time limit. */
export function hasLessonRoom({
  day,
  limitMinutes,
  plannedMinutes,
}: {
  day: Parameters<typeof getSessionDayMinutes>[0];
  limitMinutes: number | null;
  plannedMinutes: number;
}): boolean {
  const dayMinutes = getSessionDayMinutes(day);

  return (
    Math.min(dayMinutes, limitMinutes ?? dayMinutes) - plannedMinutes >= DEFAULT_LESSON_MINUTES
  );
}

/**
 * A day that holds time for unwritten lessons waits for them while they're outlined and asks the
 * learner to request them while nobody is, so its time never goes missing without a word.
 * `lessonRoom` is whether the day holds time for more lessons now.
 */
export function getDayLessons({
  blocks,
  dayMinutes,
  lessonRoom,
  outlines,
  trialEnded,
}: {
  blocks: readonly unknown[];
  dayMinutes: number;
  lessonRoom: boolean;
  outlines: DayOutlines;
  trialEnded: boolean;
}): { emptyDay: EmptyDay | null; lessonsComing: boolean; lessonsToPrepare: boolean } {
  if (blocks.length === 0) {
    const emptyDay = toEmptyDay({ dayMinutes, outlines });

    return {
      emptyDay: trialEnded && emptyDay ? "nothingNew" : emptyDay,
      lessonsComing: false,
      lessonsToPrepare: false,
    };
  }

  const open = lessonRoom && !trialEnded;

  return {
    emptyDay: null,
    lessonsComing: open && outlines === "awaiting",
    lessonsToPrepare: open && outlines === "idle",
  };
}
