"use client";

import { type DayState } from "@zoonk/core/sessions/day-state";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { showsWelcomeBack } from "@zoonk/core/view-models/today/notice";
import { type DayStep } from "../session/session-types";
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

/** A block to play next, an extra one included: a done day can still have one. */
export function useHasNextBlock(): boolean {
  const { today } = useTodayScreen();
  const { blocks, nextPosition } = today.session;

  return blocks.some((block) => block.position === nextPosition);
}

/** A wait for the day's lessons that ran out asks for them, as a day nobody is preparing does. */
export function useDayState(): DayState {
  const { today, writingStalled } = useTodayScreen();
  const { state } = today.session;

  return state === "waiting" && writingStalled ? "prepare" : state;
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

type StopLesson = Pick<DayStep, "lesson">;

/**
 * Only a lesson whose saved claim says it's being written; a lesson nobody has started making is
 * made when the learner opens it, so it never claims to be in progress.
 */
export function isStopBeingWritten(block: StopLesson): boolean {
  return block.lesson?.status === "generating";
}

export function useStepGettingReady() {
  return (block: StopLesson & { preparing: boolean }): boolean =>
    block.preparing || isStopBeingWritten(block);
}

type UpNextLesson = TodayView["session"]["extraTime"]["lessons"][number];

export function useUpNextLessons(): UpNextLesson[] {
  const pastDate = useTodayPastDate();
  const { today } = useTodayScreen();
  const { extraTime } = today.session;

  return pastDate || !extraTime.available ? [] : extraTime.lessons;
}
