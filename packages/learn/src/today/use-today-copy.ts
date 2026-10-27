"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { useTodayScreen } from "./today-context";
import { type DayState, getDayState, getSessionState } from "./today-day-state";

/** The session's day as the learner reads it: "Wednesday, October 7". */
export function useTodayDate(): string {
  const format = useFormatter();
  const { today } = useTodayScreen();

  return format.dateTime(today.session.localDate, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });
}

const NO_BREAK_SPACE = "\u00A0";

/**
 * A return after a break: Today opens with the greeting and the lighter day, and leaves the rest
 * (the notice, how far behind the plan is) after them or to the Plan.
 */
export function isWelcomeBackDay(session: Pick<TodayView["session"], "freshStart">): boolean {
  return session.freshStart === "welcomeBack";
}

/**
 * A fresh start says why today is lighter, kindly and briefly; a return after a break says how long
 * the day takes, since "lighter" beside 12 activities said nothing. Null on an ordinary day.
 */
export function useFreshStartText(): string | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const { blocks, freshStart } = today.session;

  // The time stays on one line: "about 55" ending a line and "min" starting the next.
  const time = formatDuration(
    blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
  ).replaceAll(" ", NO_BREAK_SPACE);

  switch (freshStart) {
    case "welcomeBack":
      // A free exam plan past its first week is shorter for what Plus holds, not lighter for the
      // break.
      return today.session.examAccess.trialEnded
        ? t("Welcome back! Today takes about {time}, so it's easy to pick up again.", { time })
        : t("Welcome back! Today is lighter, about {time}, so it's easy to pick up again.", {
            time,
          });
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

export function useSessionState() {
  const { today } = useTodayScreen();
  return getSessionState(today.session);
}

export function useDayState(): DayState {
  const { today } = useTodayScreen();
  return getDayState(today.session);
}

type PastDate = Extract<
  NonNullable<NonNullable<TodayView["progress"]>["status"]>,
  { kind: "pastDate" }
>;

/**
 * The goal's date came with lessons left, and today has nothing planned (its time is over): the
 * day's line says so and its action opens the Plan, whose slot keeps the plan going. Null on any
 * other day, and on one whose session still has blocks to go on with or is done.
 */
export function useTodayPastDate(): PastDate | null {
  const { today } = useTodayScreen();
  const state = useDayState();
  const status = today.progress?.status;

  return status?.kind === "pastDate" && (state === "rest" || state === "ahead") ? status : null;
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

type UpNextLesson = TodayView["session"]["extraTime"]["lessons"][number];

/**
 * The plan's next lessons "Keep learning" adds, on a day with nothing left to start: a rest day,
 * or once the day's session is done. Empty on any other day, and when the time would go to
 * practice instead (every lesson is done) or isn't there to take.
 */
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
