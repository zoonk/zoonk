"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted, useFormatter } from "next-intl";
import { useTodayScreen } from "./today-context";

/** The session's day as the learner reads it: "Wednesday, October 7". */
export function useTodayDate(): string {
  const format = useFormatter();
  const { today } = useTodayScreen();

  return format.dateTime(today.session.localDate, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });
}

/** A fresh start says why today is lighter, kindly and briefly. Null on an ordinary day. */
export function useFreshStartText(): string | null {
  const t = useExtracted();
  const { today } = useTodayScreen();

  switch (today.session.freshStart) {
    case "welcomeBack":
      return t("Welcome back! Today is a lighter session, so it's easy to pick up again.");
    case "newPhase":
      return t("A new phase starts today, with an easy warm-up first.");
    case "newWeek":
      return t("A fresh week. Today starts with an easy warm-up.");
    case null:
      return null;
    default:
      return null;
  }
}

type SessionDay = Pick<
  TodayView["session"],
  "blocks" | "dailyLimit" | "emptyDay" | "minutes" | "nextBlockId"
>;

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

export function useSessionState() {
  const { today } = useTodayScreen();
  return getSessionState(today.session);
}

type StopLesson = { kind: string; lessonId: string | null };

/**
 * Whether a stop's lesson is being written right now. A lesson nobody has started writing is
 * written when the learner opens it (its page shows the progress), so it never claims to be in
 * progress. Only lessons have content to write.
 */
export function isStopBeingWritten({
  block,
  lessonStatus,
}: {
  block: StopLesson;
  lessonStatus: TodayView["lessonStatus"];
}): boolean {
  return (
    block.kind === "learn" &&
    block.lessonId !== null &&
    lessonStatus[block.lessonId] === "generating"
  );
}

/**
 * Whether a stop says its lesson is on its way: while it's being written, until Today stopped
 * reading itself again because the writing looks stuck.
 */
export function useLessonBeingWritten() {
  const { today, writingStalled } = useTodayScreen();

  return (block: StopLesson): boolean =>
    !writingStalled && isStopBeingWritten({ block, lessonStatus: today.lessonStatus });
}
