"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { useTodayScreen } from "./today-context";
import { type DayState, getDayState, getSessionState } from "./today-day-state";

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

export function isWelcomeBackDay(session: Pick<TodayView["session"], "freshStart">): boolean {
  return session.freshStart === "welcomeBack";
}

/**
 * A return after a break says how long the day takes, since "lighter" beside 12 activities said
 * nothing.
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

export function useTodayPastDate(): PastDate | null {
  const { today } = useTodayScreen();
  const state = useDayState();
  const status = today.progress?.status;

  return status?.kind === "pastDate" && (state === "rest" || state === "ahead") ? status : null;
}

type StopLesson = { kind: string; lessonId: string | null };

/**
 * A lesson nobody has started writing is written when the learner opens it, so it never claims to
 * be in progress.
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

export function useLessonBeingWritten() {
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
