import { type StudyDay } from "../session/session-types";

export type SessionDay = Pick<StudyDay, "dailyLimit" | "emptyDay" | "minutes" | "nextPosition"> & {
  blocks: readonly Pick<StudyDay["blocks"][number], "position" | "status">[];
};

/**
 * A day with no blocks is a rest day, one still being outlined (`waiting`), one whose lessons wait
 * for the learner to ask for them (`prepare`), or one with nothing new (`ahead`): never a finished
 * session.
 */
export function getSessionState(session: SessionDay) {
  const empty = session.blocks.length === 0;
  const limitReached = session.dailyLimit?.reached === true;
  const studyDay = empty && !limitReached && session.minutes.dailyGoal > 0;

  return {
    ahead: studyDay && (session.emptyDay === "nothingNew" || session.emptyDay === null),
    done: !empty && session.nextPosition === null,
    limitReached,
    prepare: studyDay && session.emptyDay === "lessonsToPrepare",
    rest: empty && !limitReached && session.minutes.dailyGoal === 0,
    started: session.blocks.some((block) => block.status !== "pending"),
    waiting: studyDay && session.emptyDay === "lessonsComing",
  };
}

export type DayState = "ahead" | "done" | "limit" | "prepare" | "rest" | "underway" | "waiting";

export function getDayState(session: SessionDay): DayState {
  const { ahead, done, limitReached, prepare, rest, waiting } = getSessionState(session);
  const hasNext = session.blocks.some((block) => block.position === session.nextPosition);

  if (waiting) {
    return "waiting";
  }

  if (prepare) {
    return "prepare";
  }

  if (hasNext && !limitReached) {
    return "underway";
  }

  if (limitReached && !done) {
    return "limit";
  }

  if (ahead) {
    return "ahead";
  }

  return rest ? "rest" : "done";
}
