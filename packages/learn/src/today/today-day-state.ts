import { type TodayView } from "@zoonk/core/view-models/today/get";

export type SessionDay = Pick<
  TodayView["session"],
  "dailyLimit" | "emptyDay" | "minutes" | "nextBlockId"
> & { blocks: readonly Pick<TodayView["session"]["blocks"][number], "id" | "status">[] };

/**
 * Where the day stands, for the main button and the done state. A day with no blocks is a rest
 * day (the plan gives it no time), a day whose lessons are still being outlined, which fills in on
 * its own (`waiting`), or a day the plan has nothing new for: every lesson done or one the learner
 * already knows (`ahead`). None of them is a finished session.
 */
export function getSessionState(session: SessionDay) {
  const empty = session.blocks.length === 0;
  const limitReached = session.dailyLimit?.reached === true;
  const studyDay = empty && !limitReached && session.minutes.dailyGoal > 0;

  return {
    ahead: studyDay && session.emptyDay !== "lessonsComing",
    done: !empty && session.nextBlockId === null,
    limitReached,
    rest: empty && !limitReached && session.minutes.dailyGoal === 0,
    started: session.blocks.some((block) => block.status !== "pending"),
    waiting: studyDay && session.emptyDay === "lessonsComing",
  };
}

/**
 * The one thing the day is now, for its status line and its main action: a block to go on with
 * (`underway`), its blocks done, the study time used up (`limit`), nothing new, a rest day, or its
 * lessons still being outlined (`waiting`).
 */
export type DayState = "ahead" | "done" | "limit" | "rest" | "underway" | "waiting";

export function getDayState(session: SessionDay): DayState {
  const { ahead, done, limitReached, rest, waiting } = getSessionState(session);
  const hasNext = session.blocks.some((block) => block.id === session.nextBlockId);

  if (waiting) {
    return "waiting";
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
