"use client";

import { type DayState } from "@zoonk/core/sessions/day-state";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { showsWelcomeBack } from "@zoonk/core/view-models/today/notice";
import { useTodayScreen } from "./today-context";

export function isWelcomeBackDay(session: Pick<TodayView["session"], "freshStart">): boolean {
  return session.freshStart === "welcomeBack";
}

/**
 * The first visit after days away, until the learner starts: its welcome leads the day, and what
 * else Today would say waits.
 */
export function useWelcomeBack(): boolean {
  const { today } = useTodayScreen();
  const { state } = today.session;

  return showsWelcomeBack(today) && state !== "ahead" && state !== "rest";
}

export function useSessionState() {
  const { today } = useTodayScreen();
  const { blocks, state } = today.session;

  return {
    ahead: state === "ahead",
    done: state === "done",
    rest: state === "rest",
    started: blocks.some((block) => block.status !== "pending"),
    waiting: state === "waiting",
  };
}

export function useDayState(): DayState {
  const { today } = useTodayScreen();
  return today.session.state;
}

type PastDate = Extract<
  NonNullable<NonNullable<TodayView["progress"]>["status"]>,
  { kind: "pastDate" }
>;

export function useTodayPastDate(): PastDate | null {
  const { today } = useTodayScreen();
  const state = useDayState();
  const status = today.progress?.status;

  return status?.kind === "pastDate" && (state === "rest" || state === "ahead") ? status : null;
}

type StopLesson = { kind: string; lessonId: string | null };

/**
 * A lesson nobody has started making is made when the learner opens it, so it never claims to be
 * in progress.
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

export function useLessonGettingReady() {
  const { today, writingStalled } = useTodayScreen();

  return (block: StopLesson): boolean =>
    !writingStalled && isStopBeingWritten({ block, lessonStatus: today.lessonStatus });
}

type UpNextLesson = TodayView["session"]["extraTime"]["lessons"][number];

export function useUpNextLessons(): UpNextLesson[] {
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const { today } = useTodayScreen();
  const { extraTime } = today.session;

  if (pastDate || (state !== "done" && state !== "rest") || !extraTime.available) {
    return [];
  }

  return extraTime.lessons;
}
