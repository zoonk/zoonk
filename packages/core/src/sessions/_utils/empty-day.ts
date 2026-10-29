import { type StudyBlockKind } from "@zoonk/db";
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

/**
 * A day without a lesson of its own, empty or only practice, waits for its unwritten lessons while
 * they're outlined and asks the learner to request them while nobody is. A day with lessons only
 * says more are coming. `lessonRoom` is whether the day holds time for more lessons now.
 */
export function getDayLessons({
  blocks,
  dayMinutes,
  lessonRoom,
  outlines,
  trialEnded,
}: {
  blocks: readonly { kind: StudyBlockKind }[];
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
  const ownLesson = blocks.some((block) => block.kind === "learn");

  return {
    emptyDay: null,
    lessonsComing: open && outlines === "awaiting",
    lessonsToPrepare: open && !ownLesson && outlines === "idle",
  };
}
