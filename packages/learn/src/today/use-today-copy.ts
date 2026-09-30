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

/** Where the day stands, for the main button and the done state. */
export function useSessionState() {
  const { today } = useTodayScreen();
  const { session } = today;
  const started = session.blocks.some((block) => block.status !== "pending");

  return {
    done: session.nextBlockId === null,
    limitReached: session.dailyLimit?.reached === true,
    started,
  };
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
